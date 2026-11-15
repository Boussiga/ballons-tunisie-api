jest.mock("../../../config/prisma", () => ({
  produit: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  produitImage: {
    findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(),
    update: jest.fn(), delete: jest.fn(),
  },
  ligneCommande: { count: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock("../../../middelwhere/upload.middleware", () => ({
  deleteImage: jest.fn(),
  supprimerEnvois: jest.fn(),
}));

const prisma = require("../../../config/prisma");
const { deleteImage, supprimerEnvois } = require("../../../middelwhere/upload.middleware");
const {
  createProduit, updateProduit, supprimerImage, definirImagePrincipale, deleteProduit,
} = require("../../../controller/admin.produit.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

const fichiers = (n) => Array.from({ length: n }, (_, i) => ({ url: `https://res.cloudinary.com/x/new${i}.png`, publicId: `p/new${i}` }));
const images = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, url: `https://res.cloudinary.com/x/old${i}.png`, ordre: i }));

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
beforeEach(() => {
  // Interactive transactions run against the same mocked client
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  prisma.produit.update.mockImplementation(({ where }) => Promise.resolve({ id: where.id }));
});

describe("createProduit", () => {
  it("saves up to 5 images in order, the first one as main image", async () => {
    prisma.produit.create.mockResolvedValue({ id: 1 });
    const req = { ...mockRequest({ body: { nom: "Ballon", prix: 50 } }), files: fichiers(3) };
    const res = mockResponse();

    await createProduit(req, res);

    const { data } = prisma.produit.create.mock.calls[0][0];
    expect(data.imageUrl).toBe("https://res.cloudinary.com/x/new0.png");
    expect(data.images.create).toEqual([0, 1, 2].map((i) => ({ url: `https://res.cloudinary.com/x/new${i}.png`, ordre: i })));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("works without images", async () => {
    prisma.produit.create.mockResolvedValue({ id: 1 });
    const res = mockResponse();
    await createProduit({ ...mockRequest({ body: { nom: "Ballon", prix: 50 } }), files: [] }, res);
    expect(prisma.produit.create.mock.calls[0][0].data).toMatchObject({ imageUrl: null, images: { create: [] } });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("removes the uploaded images when the database fails", async () => {
    prisma.produit.create.mockRejectedValue(new Error("db down"));
    const files = fichiers(2);
    const res = mockResponse();
    await createProduit({ ...mockRequest({ body: {} }), files }, res);
    expect(supprimerEnvois).toHaveBeenCalledWith(files);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("updateProduit", () => {
  const req = (files, imagePrincipale = false) =>
    ({ ...mockRequest({ params: { id: 7 }, body: { prix: 60 } }), files, imagePrincipale });

  it("adds the new images after the current ones", async () => {
    prisma.produit.findUnique.mockResolvedValue({ id: 7, imageUrl: images(2)[0].url });
    prisma.produitImage.findMany.mockResolvedValue(images(2));
    const res = mockResponse();

    await updateProduit(req(fichiers(2)), res);

    expect(prisma.produitImage.createMany).toHaveBeenCalledWith({
      data: [
        { produitId: 7, url: "https://res.cloudinary.com/x/new0.png", ordre: 2 },
        { produitId: 7, url: "https://res.cloudinary.com/x/new1.png", ordre: 3 },
      ],
    });
    expect(deleteImage).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("refuses more than 5 images and removes the uploaded ones", async () => {
    prisma.produit.findUnique.mockResolvedValue({ id: 7, imageUrl: null });
    prisma.produitImage.findMany.mockResolvedValue(images(4));
    const files = fichiers(2);
    const res = mockResponse();

    await updateProduit(req(files), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.produitImage.createMany).not.toHaveBeenCalled();
    expect(supprimerEnvois).toHaveBeenCalledWith(files);
  });

  it("'image' field: replaces the main image and deletes the old file", async () => {
    prisma.produit.findUnique.mockResolvedValue({ id: 7, imageUrl: images(5)[0].url });
    prisma.produitImage.findMany.mockResolvedValue(images(5));
    const res = mockResponse();

    await updateProduit(req(fichiers(1), true), res); // 5 - 1 replaced + 1 new = 5: allowed

    expect(prisma.produitImage.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.produitImage.createMany.mock.calls[0][0].data[0]).toMatchObject({ ordre: -1 }); // goes first
    expect(deleteImage).toHaveBeenCalledWith("https://res.cloudinary.com/x/old0.png");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("turns the single image of an older product into its first gallery image", async () => {
    prisma.produit.findUnique.mockResolvedValue({ id: 7, imageUrl: "https://res.cloudinary.com/x/legacy.png" });
    prisma.produitImage.findMany.mockResolvedValue([]);
    prisma.produitImage.create.mockResolvedValue({ id: 9, url: "https://res.cloudinary.com/x/legacy.png", ordre: 0 });
    const res = mockResponse();

    await updateProduit(req(fichiers(1)), res);

    expect(prisma.produitImage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { produitId: 7, url: "https://res.cloudinary.com/x/legacy.png", ordre: 0 },
    }));
    expect(prisma.produitImage.createMany.mock.calls[0][0].data[0]).toMatchObject({ ordre: 1 });
  });

  it("returns 404 and removes the uploads for an unknown product", async () => {
    prisma.produit.findUnique.mockResolvedValue(null);
    const files = fichiers(1);
    const res = mockResponse();
    await updateProduit(req(files), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(supprimerEnvois).toHaveBeenCalledWith(files);
  });
});

describe("supprimerImage / definirImagePrincipale", () => {
  const req = mockRequest({ params: { id: 7, imageId: 2 } });

  it("404 when the image does not belong to the product", async () => {
    prisma.produitImage.findFirst.mockResolvedValue(null);
    for (const action of [supprimerImage, definirImagePrincipale]) {
      const res = mockResponse();
      await action(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    }
    expect(prisma.produitImage.findFirst).toHaveBeenCalledWith({ where: { id: 2, produitId: 7 } });
  });

  it("deletes the image, renumbers the others and updates the main image", async () => {
    prisma.produitImage.findFirst.mockResolvedValue({ id: 2, url: "https://res.cloudinary.com/x/old1.png" });
    // After the delete: images 1 and 3 remain, with a gap in ordre
    prisma.produitImage.findMany.mockResolvedValue([{ id: 1, url: "u1", ordre: 0 }, { id: 3, url: "u3", ordre: 2 }]);
    const res = mockResponse();

    await supprimerImage(req, res);

    expect(prisma.produitImage.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(prisma.produitImage.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { ordre: 1 } });
    expect(prisma.produit.update).toHaveBeenCalledWith(expect.objectContaining({ data: { imageUrl: "u1" } }));
    expect(deleteImage).toHaveBeenCalledWith("https://res.cloudinary.com/x/old1.png");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("clears imageUrl when the last image is deleted", async () => {
    prisma.produitImage.findFirst.mockResolvedValue({ id: 2, url: "u2" });
    prisma.produitImage.findMany.mockResolvedValue([]);
    await supprimerImage(req, mockResponse());
    expect(prisma.produit.update).toHaveBeenCalledWith(expect.objectContaining({ data: { imageUrl: null } }));
  });

  it("puts the chosen image first and copies it to imageUrl", async () => {
    prisma.produitImage.findFirst.mockResolvedValue({ id: 2, url: "u2" });
    prisma.produitImage.findMany.mockResolvedValue([{ id: 2, url: "u2", ordre: -1 }, { id: 1, url: "u1", ordre: 0 }]);
    const res = mockResponse();

    await definirImagePrincipale(req, res);

    expect(prisma.produitImage.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { ordre: -1 } });
    expect(prisma.produitImage.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { ordre: 0 } });
    expect(prisma.produitImage.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { ordre: 1 } });
    expect(prisma.produit.update).toHaveBeenCalledWith(expect.objectContaining({ data: { imageUrl: "u2" } }));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("deleteProduit", () => {
  it("removes every gallery image from Cloudinary", async () => {
    prisma.produit.findUnique.mockResolvedValue({ id: 7, imageUrl: "u1", images: [{ url: "u1" }, { url: "u2" }] });
    prisma.ligneCommande.count.mockResolvedValue(0);
    const res = mockResponse();

    await deleteProduit(mockRequest({ params: { id: 7 } }), res);

    expect(deleteImage.mock.calls.map((c) => c[0]).sort()).toEqual(["u1", "u2"]);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
