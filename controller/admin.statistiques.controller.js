const prisma = require("../config/prisma");
const { statistiquesQuery } = require("../validations/statistiques.validation");
const { STATUTS } = require("../validations/commande.validation");

const JOUR_MS = 24 * 60 * 60 * 1000;
const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SEUIL_STOCK_FAIBLE = 5;
const SEUIL_RISQUE_RUPTURE_JOURS = 14;
const TOP = 10;

// Governorates matched in the free-text delivery address (accent-insensitive).
// A few big cities are listed as aliases of their governorate.
const GOUVERNORATS = [
  { nom: "Tunis", alias: ["tunis", "la marsa", "carthage", "le bardo", "la goulette"] },
  { nom: "Ariana", alias: ["ariana", "ennasr", "raoued", "la soukra"] },
  { nom: "Ben Arous", alias: ["ben arous", "rades", "ezzahra", "megrine", "hammam lif"] },
  { nom: "Manouba", alias: ["manouba", "mannouba", "den den", "oued ellil"] },
  { nom: "Nabeul", alias: ["nabeul", "hammamet", "kelibia", "korba"] },
  { nom: "Zaghouan", alias: ["zaghouan"] },
  { nom: "Bizerte", alias: ["bizerte", "menzel bourguiba"] },
  { nom: "Béja", alias: ["beja"] },
  { nom: "Jendouba", alias: ["jendouba", "tabarka"] },
  { nom: "Le Kef", alias: ["le kef", "kef"] },
  { nom: "Siliana", alias: ["siliana"] },
  { nom: "Sousse", alias: ["sousse", "msaken", "hammam sousse", "kalaa kebira"] },
  { nom: "Monastir", alias: ["monastir", "ksar hellal", "moknine", "jemmal"] },
  { nom: "Mahdia", alias: ["mahdia", "el jem", "ksour essef"] },
  { nom: "Sfax", alias: ["sfax"] },
  { nom: "Kairouan", alias: ["kairouan"] },
  { nom: "Kasserine", alias: ["kasserine"] },
  { nom: "Sidi Bouzid", alias: ["sidi bouzid"] },
  { nom: "Gabès", alias: ["gabes"] },
  { nom: "Médenine", alias: ["medenine", "djerba", "jerba", "zarzis", "ben gardane"] },
  { nom: "Tataouine", alias: ["tataouine"] },
  { nom: "Gafsa", alias: ["gafsa", "metlaoui"] },
  { nom: "Tozeur", alias: ["tozeur", "nefta"] },
  { nom: "Kébili", alias: ["kebili", "douz"] },
].map((g) => ({
  nom: g.nom,
  regex: new RegExp(`\\b(${g.alias.join("|")})\\b`, "g"),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const r2 = (n) => Math.round(n * 100) / 100;
const pct = (part, total) => (total > 0 ? r2((part / total) * 100) : 0);

// Variation (%) vs. previous period; null when there is no base to compare to
const evolution = (actuel, precedent) => {
  if (precedent === 0) return actuel === 0 ? 0 : null;
  return r2(((actuel - precedent) / precedent) * 100);
};

const pad = (n) => String(n).padStart(2, "0");
const formatJour = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "AAAA-MM-JJ" → local midnight
const parseJour = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const ajouterJours = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Start of the bucket containing `d` (weeks start on Monday)
const debutBucket = (d, granularite) => {
  if (granularite === "mois") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (granularite === "semaine") return ajouterJours(d, -((d.getDay() + 6) % 7));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const cleBucket = (d, granularite) => {
  const debut = debutBucket(d, granularite);
  return granularite === "mois" ? formatJour(debut).slice(0, 7) : formatJour(debut);
};

const bucketSuivant = (d, granularite) => {
  if (granularite === "mois") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return ajouterJours(d, granularite === "semaine" ? 7 : 1);
};

const normaliser = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// The governorate usually comes last in an address, so keep the last match
const detecterGouvernorat = (adresse) => {
  const texte = normaliser(adresse);
  let meilleur = null;
  let position = -1;
  for (const g of GOUVERNORATS) {
    for (const m of texte.matchAll(g.regex)) {
      if (m.index > position) {
        position = m.index;
        meilleur = g.nom;
      }
    }
  }
  return meilleur || "Non identifié";
};

// Amount actually paid for an order line, after the offer discount
const montantLigne = (ligne) => {
  const reduction = ligne.offre ? ligne.offre.pourcentageReduction / 100 : 0;
  const prixUnitaire = ligne.prixInitiale * (1 - reduction);
  return {
    montant: prixUnitaire * ligne.quantite,
    remise: (ligne.prixInitiale - prixUnitaire) * ligne.quantite,
  };
};

// Increment an accumulator stored in a Map, creating it on first use
const cumuler = (map, cle, init, fn) => {
  if (!map.has(cle)) map.set(cle, { ...init, commandeIds: new Set() });
  fn(map.get(cle));
};

// Turn an accumulator Map into a sorted, rounded array
const finaliser = (map, tri) =>
  [...map.values()]
    .map(({ commandeIds, ...rest }) => ({
      ...rest,
      commandes: commandeIds.size,
      chiffreAffaires: r2(rest.chiffreAffaires),
      ...(rest.remiseAccordee !== undefined && { remiseAccordee: r2(rest.remiseAccordee) }),
    }))
    .sort((a, b) => b[tri] - a[tri]);

/**
 * @desc  Detailed business statistics over a period, compared with the previous period
 *        (revenue, orders, products, packs, offers, categories, customers, regions, stock)
 * @route GET /api/admin/dashboard/getStatistiquesDetaillees?dateDebut=AAAA-MM-JJ&dateFin=AAAA-MM-JJ&granularite=jour|semaine|mois
 * @access Private
 */
const getStatistiquesDetaillees = async (req, res) => {
  // Express 5 keeps req.query read-only: re-parse to get the validated values
  const parsed = statistiquesQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(422).json({
      message: "Données invalides.",
      erreurs: parsed.error.issues.map((e) => ({ champ: `query.${e.path.join(".")}`, message: e.message })),
    });
  }

  try {
    const now = new Date();
    const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Default period: the last 30 days, today included
    const dateFin = parsed.data.dateFin ? parseJour(parsed.data.dateFin) : aujourdhui;
    const dateDebut = parsed.data.dateDebut ? parseJour(parsed.data.dateDebut) : ajouterJours(dateFin, -29);
    const finExclue = ajouterJours(dateFin, 1);
    const nbJours = Math.round((finExclue - dateDebut) / JOUR_MS);

    // Previous period of the same length, right before the selected one
    const precDebut = ajouterJours(dateDebut, -nbJours);

    const granularite =
      parsed.data.granularite || (nbJours <= 31 ? "jour" : nbJours <= 183 ? "semaine" : "mois");

    const [commandes, commandesPrecedentes, produits, enAttenteAnciennes] = await Promise.all([
      prisma.commande.findMany({
        where: { dateCommande: { gte: dateDebut, lt: finExclue } },
        select: {
          id: true,
          dateCommande: true,
          statut: true,
          total: true,
          nomClient: true,
          telephoneClient: true,
          adresseLivraison: true,
          lignes: {
            select: {
              quantite: true,
              prixInitiale: true,
              produit: { select: { id: true, nom: true, categorie: { select: { id: true, nom: true } } } },
              pack: { select: { id: true, nom: true } },
              offre: { select: { id: true, titre: true, pourcentageReduction: true } },
            },
          },
        },
        orderBy: { dateCommande: "asc" },
      }),
      prisma.commande.findMany({
        where: { dateCommande: { gte: precDebut, lt: dateDebut } },
        select: {
          statut: true,
          total: true,
          telephoneClient: true,
          lignes: { select: { quantite: true } },
        },
      }),
      prisma.produit.findMany({
        select: { id: true, nom: true, prix: true, stock: true, categorie: { select: { nom: true } } },
      }),
      // Pending orders older than 48h, whatever the selected period
      prisma.commande.count({
        where: { statut: "en_attente", dateCommande: { lt: new Date(now.getTime() - 2 * JOUR_MS) } },
      }),
    ]);

    const valides = commandes.filter((c) => c.statut !== "annulee");
    const validesPrec = commandesPrecedentes.filter((c) => c.statut !== "annulee");

    // Customers are identified by phone number (guest checkout, no accounts)
    const telephones = [...new Set(valides.map((c) => c.telephoneClient))];
    const historiqueClients = telephones.length
      ? await prisma.commande.groupBy({
          by: ["telephoneClient"],
          where: { telephoneClient: { in: telephones }, statut: { not: "annulee" } },
          _min: { dateCommande: true },
          _count: { _all: true },
        })
      : [];

    // ── Summary ──────────────────────────────────────────────────────────────
    const somme = (list, fn) => list.reduce((s, x) => s + fn(x), 0);
    const articles = (c) => somme(c.lignes, (l) => l.quantite);

    const chiffreAffaires = somme(valides, (c) => c.total);
    const chiffreAffairesPrec = somme(validesPrec, (c) => c.total);
    const articlesVendus = somme(valides, articles);
    const articlesVendusPrec = somme(validesPrec, articles);
    const panierMoyen = valides.length ? chiffreAffaires / valides.length : 0;
    const panierMoyenPrec = validesPrec.length ? chiffreAffairesPrec / validesPrec.length : 0;
    const clientsPrec = new Set(validesPrec.map((c) => c.telephoneClient)).size;
    const annulees = commandes.length - valides.length;
    const annuleesPrec = commandesPrecedentes.length - validesPrec.length;

    const parStatut = Object.fromEntries(STATUTS.map((s) => [s, { nombre: 0, montant: 0 }]));
    for (const c of commandes) {
      if (!parStatut[c.statut]) parStatut[c.statut] = { nombre: 0, montant: 0 };
      parStatut[c.statut].nombre += 1;
      parStatut[c.statut].montant += c.total;
    }
    for (const s of Object.values(parStatut)) s.montant = r2(s.montant);

    // ── Time series (empty buckets included so charts have no gaps) ─────────
    const series = new Map();
    for (let d = debutBucket(dateDebut, granularite); d < finExclue; d = bucketSuivant(d, granularite)) {
      const cle = cleBucket(d, granularite);
      series.set(cle, { periode: cle, chiffreAffaires: 0, commandes: 0, commandesAnnulees: 0, articlesVendus: 0, panierMoyen: 0 });
    }
    for (const c of commandes) {
      const point = series.get(cleBucket(c.dateCommande, granularite));
      if (!point) continue;
      if (c.statut === "annulee") {
        point.commandesAnnulees += 1;
      } else {
        point.commandes += 1;
        point.chiffreAffaires += c.total;
        point.articlesVendus += articles(c);
      }
    }
    const evolutionSerie = [...series.values()].map((p) => ({
      ...p,
      chiffreAffaires: r2(p.chiffreAffaires),
      panierMoyen: p.commandes ? r2(p.chiffreAffaires / p.commandes) : 0,
    }));

    // ── Products / packs / offers / categories ──────────────────────────────
    const parProduit = new Map();
    const parPack = new Map();
    const parOffre = new Map();
    const parCategorie = new Map();
    let remisesAccordees = 0;

    for (const c of valides) {
      for (const l of c.lignes) {
        const { montant, remise } = montantLigne(l);
        remisesAccordees += remise;
        const ajouter = (acc) => {
          acc.quantite += l.quantite;
          acc.chiffreAffaires += montant;
          acc.commandeIds.add(c.id);
        };

        if (l.produit) {
          cumuler(parProduit, l.produit.id, { id: l.produit.id, nom: l.produit.nom, quantite: 0, chiffreAffaires: 0 }, ajouter);
          const cat = l.produit.categorie || { id: null, nom: "Sans catégorie" };
          cumuler(parCategorie, `c${cat.id}`, { id: cat.id, nom: cat.nom, quantite: 0, chiffreAffaires: 0 }, ajouter);
        }
        if (l.pack) {
          cumuler(parPack, l.pack.id, { id: l.pack.id, nom: l.pack.nom, quantite: 0, chiffreAffaires: 0 }, ajouter);
          cumuler(parCategorie, "packs", { id: null, nom: "Packs", quantite: 0, chiffreAffaires: 0 }, ajouter);
        }
        if (l.offre) {
          cumuler(
            parOffre,
            l.offre.id,
            { id: l.offre.id, titre: l.offre.titre, pourcentageReduction: l.offre.pourcentageReduction, quantite: 0, chiffreAffaires: 0, remiseAccordee: 0 },
            (acc) => { ajouter(acc); acc.remiseAccordee += remise; }
          );
        }
      }
    }

    const produitsVendus = finaliser(parProduit, "chiffreAffaires");
    const totalCategories = somme([...parCategorie.values()], (c) => c.chiffreAffaires);
    const categories = finaliser(parCategorie, "chiffreAffaires").map((c) => ({
      ...c,
      part: pct(c.chiffreAffaires, totalCategories),
    }));
    const offres = finaliser(parOffre, "chiffreAffaires");
    const commandesAvecOffre = new Set(
      valides.filter((c) => c.lignes.some((l) => l.offre)).map((c) => c.id)
    ).size;

    // ── Customers ────────────────────────────────────────────────────────────
    const parClient = new Map();
    for (const c of valides) {
      cumuler(
        parClient,
        c.telephoneClient,
        { nomClient: c.nomClient, telephoneClient: c.telephoneClient, chiffreAffaires: 0 },
        (acc) => { acc.chiffreAffaires += c.total; acc.commandeIds.add(c.id); }
      );
    }
    const nouveauxClients = historiqueClients.filter((h) => h._min.dateCommande >= dateDebut).length;
    const clientsFideles = historiqueClients.filter((h) => h._count._all >= 2).length;

    // ── Regions ──────────────────────────────────────────────────────────────
    const parRegion = new Map();
    for (const c of valides) {
      const nom = detecterGouvernorat(c.adresseLivraison);
      cumuler(parRegion, nom, { gouvernorat: nom, chiffreAffaires: 0 }, (acc) => {
        acc.chiffreAffaires += c.total;
        acc.commandeIds.add(c.id);
      });
    }
    const regions = finaliser(parRegion, "chiffreAffaires").map((r) => ({
      ...r,
      part: pct(r.chiffreAffaires, chiffreAffaires),
    }));

    // ── Buying habits ────────────────────────────────────────────────────────
    const parJour = JOURS_SEMAINE.map((jour) => ({ jour, commandes: 0, chiffreAffaires: 0 }));
    const parHeure = Array.from({ length: 24 }, (_, heure) => ({ heure, commandes: 0, chiffreAffaires: 0 }));
    for (const c of valides) {
      const j = parJour[(c.dateCommande.getDay() + 6) % 7];
      const h = parHeure[c.dateCommande.getHours()];
      j.commandes += 1;
      j.chiffreAffaires += c.total;
      h.commandes += 1;
      h.chiffreAffaires += c.total;
    }
    for (const x of [...parJour, ...parHeure]) x.chiffreAffaires = r2(x.chiffreAffaires);

    // ── Stock health ─────────────────────────────────────────────────────────
    // Only direct product lines decrement stock, so coverage uses those sales
    const quantiteVendue = new Map(produitsVendus.map((p) => [p.id, p.quantite]));
    const risqueRupture = produits
      .filter((p) => p.stock > 0 && quantiteVendue.has(p.id))
      .map((p) => {
        const ventesParJour = quantiteVendue.get(p.id) / nbJours;
        return {
          id: p.id,
          nom: p.nom,
          stock: p.stock,
          ventesParJour: r2(ventesParJour),
          joursRestants: Math.floor(p.stock / ventesParJour),
        };
      })
      .filter((p) => p.joursRestants < SEUIL_RISQUE_RUPTURE_JOURS)
      .sort((a, b) => a.joursRestants - b.joursRestants);

    const sansVente = produits
      .filter((p) => p.stock > 0 && !quantiteVendue.has(p.id))
      .map((p) => ({ id: p.id, nom: p.nom, stock: p.stock, valeurStock: r2(p.prix * p.stock) }))
      .sort((a, b) => b.valeurStock - a.valeurStock);

    const ruptures = produits.filter((p) => p.stock === 0);
    const stockFaible = produits.filter((p) => p.stock > 0 && p.stock < SEUIL_STOCK_FAIBLE);

    // ── Alerts: what needs the admin's attention ────────────────────────────
    const tauxAnnulation = pct(annulees, commandes.length);
    const evolutionCA = evolution(chiffreAffaires, chiffreAffairesPrec);
    const alertes = [];
    if (enAttenteAnciennes > 0)
      alertes.push({ niveau: "danger", message: `${enAttenteAnciennes} commande(s) en attente depuis plus de 48h.` });
    if (ruptures.length > 0)
      alertes.push({ niveau: "danger", message: `${ruptures.length} produit(s) en rupture de stock.` });
    if (risqueRupture.length > 0)
      alertes.push({ niveau: "warning", message: `${risqueRupture.length} produit(s) risquent la rupture dans moins de ${SEUIL_RISQUE_RUPTURE_JOURS} jours au rythme actuel.` });
    if (commandes.length >= 5 && tauxAnnulation > 15)
      alertes.push({ niveau: "warning", message: `Taux d'annulation élevé : ${tauxAnnulation}%.` });
    if (evolutionCA !== null && evolutionCA <= -10)
      alertes.push({ niveau: "warning", message: `Chiffre d'affaires en baisse de ${Math.abs(evolutionCA)}% par rapport à la période précédente.` });
    if (evolutionCA !== null && evolutionCA >= 10)
      alertes.push({ niveau: "info", message: `Chiffre d'affaires en hausse de ${evolutionCA}% par rapport à la période précédente.` });
    if (sansVente.length > 0)
      alertes.push({ niveau: "info", message: `${sansVente.length} produit(s) en stock sans aucune vente sur la période.` });

    res.status(200).json({
      periode: {
        dateDebut: formatJour(dateDebut),
        dateFin: formatJour(dateFin),
        nbJours,
        granularite,
        periodePrecedente: { dateDebut: formatJour(precDebut), dateFin: formatJour(ajouterJours(dateDebut, -1)) },
      },
      resume: {
        chiffreAffaires: r2(chiffreAffaires),
        chiffreAffairesEncaisse: parStatut.livree.montant,
        chiffreAffairesEnCours: r2(parStatut.en_attente.montant + parStatut.confirmee.montant),
        chiffreAffairesPerdu: parStatut.annulee.montant,
        caMoyenParJour: r2(chiffreAffaires / nbJours),
        nombreCommandes: commandes.length,
        commandesValides: valides.length,
        commandesAnnulees: annulees,
        panierMoyen: r2(panierMoyen),
        articlesVendus,
        articlesParCommande: valides.length ? r2(articlesVendus / valides.length) : 0,
        remisesAccordees: r2(remisesAccordees),
        tauxAnnulation,
        tauxLivraison: pct(parStatut.livree.nombre, valides.length),
        clientsUniques: telephones.length,
      },
      comparaison: {
        chiffreAffaires: { actuel: r2(chiffreAffaires), precedent: r2(chiffreAffairesPrec), evolution: evolutionCA },
        commandes: { actuel: valides.length, precedent: validesPrec.length, evolution: evolution(valides.length, validesPrec.length) },
        panierMoyen: { actuel: r2(panierMoyen), precedent: r2(panierMoyenPrec), evolution: evolution(panierMoyen, panierMoyenPrec) },
        articlesVendus: { actuel: articlesVendus, precedent: articlesVendusPrec, evolution: evolution(articlesVendus, articlesVendusPrec) },
        clients: { actuel: telephones.length, precedent: clientsPrec, evolution: evolution(telephones.length, clientsPrec) },
        commandesAnnulees: { actuel: annulees, precedent: annuleesPrec, evolution: evolution(annulees, annuleesPrec) },
      },
      commandesParStatut: parStatut,
      evolution: evolutionSerie,
      produits: {
        topParChiffreAffaires: produitsVendus.slice(0, TOP),
        topParQuantite: [...produitsVendus].sort((a, b) => b.quantite - a.quantite).slice(0, TOP),
        nombreProduitsVendus: produitsVendus.length,
      },
      categories,
      packs: finaliser(parPack, "chiffreAffaires"),
      offres: {
        commandesAvecOffre,
        partCommandesAvecOffre: pct(commandesAvecOffre, valides.length),
        remisesAccordees: r2(remisesAccordees),
        details: offres,
      },
      clients: {
        uniques: telephones.length,
        nouveaux: nouveauxClients,
        recurrents: telephones.length - nouveauxClients,
        fideles: clientsFideles,
        tauxFidelite: pct(clientsFideles, telephones.length),
        valeurMoyenneClient: telephones.length ? r2(chiffreAffaires / telephones.length) : 0,
        topClients: finaliser(parClient, "chiffreAffaires").slice(0, TOP),
      },
      regions,
      habitudes: { parJourSemaine: parJour, parHeure },
      stock: {
        valeurStock: r2(somme(produits, (p) => p.prix * p.stock)),
        totalProduits: produits.length,
        ruptures: ruptures.map((p) => ({ id: p.id, nom: p.nom })),
        stockFaible: stockFaible.map((p) => ({ id: p.id, nom: p.nom, stock: p.stock })),
        risqueRupture,
        sansVente: {
          nombre: sansVente.length,
          valeurImmobilisee: r2(somme(sansVente, (p) => p.valeurStock)),
          produits: sansVente.slice(0, TOP),
        },
      },
      alertes,
    });
  } catch (error) {
    console.error("Erreur getStatistiquesDetaillees:", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};

module.exports = { getStatistiquesDetaillees };
