jest.mock("../../../config/prisma", () => ({
  administrateur: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
}));
jest.mock("bcryptjs", () => ({ compare: jest.fn(), hash: jest.fn() }));

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../../../config/prisma");
const auth = require("../../../controller/admin.auth.controller");
const { mockRequest, mockResponse } = require("../../helpers/http");

const ADMIN = { id: 1, nom: "Admin", email: "admin@test.tn", motDePasse: "hash" };

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("login", () => {
  const req = () => mockRequest({ body: { email: ADMIN.email, motDePasse: "Secret123" } });

  it("returns 400 when a field is missing", async () => {
    const res = mockResponse();
    await auth.login(mockRequest({ body: { email: ADMIN.email } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 for an unknown email", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(null);
    const res = mockResponse();
    await auth.login(req(), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 for a wrong password", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(ADMIN);
    bcrypt.compare.mockResolvedValue(false);
    const res = mockResponse();
    await auth.login(req(), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("returns a signed access token and a stored refresh token", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(ADMIN);
    bcrypt.compare.mockResolvedValue(true);
    prisma.refreshToken.create.mockResolvedValue({});
    const res = mockResponse();

    await auth.login(req(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(jwt.verify(body.accessToken, "test-secret")).toMatchObject({ id: 1, email: ADMIN.email });
    expect(body.refreshToken).toMatch(/^[a-f0-9]{128}$/);
    expect(body.admin).toEqual({ id: 1, nom: "Admin", email: ADMIN.email });
    expect(body.admin).not.toHaveProperty("motDePasse");
    expect(prisma.refreshToken.create.mock.calls[0][0].data).toMatchObject({ token: body.refreshToken, adminId: 1 });
  });

  it("returns 500 when the database fails", async () => {
    prisma.administrateur.findUnique.mockRejectedValue(new Error("db down"));
    const res = mockResponse();
    await auth.login(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("refreshToken", () => {
  const req = () => mockRequest({ body: { refreshToken: "tok" } });
  const future = new Date(Date.now() + 60_000);

  it("returns 400 without token", async () => {
    const res = mockResponse();
    await auth.refreshToken(mockRequest(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 for an unknown token", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    const res = mockResponse();
    await auth.refreshToken(req(), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 for a revoked token", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ revokedAt: new Date(), expiresAt: future, admin: ADMIN });
    const res = mockResponse();
    await auth.refreshToken(req(), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].message).toMatch(/révoqué/);
  });

  it("deletes an expired token and returns 401", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ revokedAt: null, expiresAt: new Date(Date.now() - 1000), admin: ADMIN });
    const res = mockResponse();
    await auth.refreshToken(req(), res);
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { token: "tok" } });
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rotates a valid token", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ revokedAt: null, expiresAt: future, admin: ADMIN });
    const res = mockResponse();

    await auth.refreshToken(req(), res);

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { token: "tok" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].refreshToken).not.toBe("tok");
  });
});

describe("logout / logoutAll", () => {
  it("revokes the given token", async () => {
    const res = mockResponse();
    await auth.logout(mockRequest({ body: { refreshToken: "tok" } }), res);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { token: "tok", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("succeeds without touching the DB when no token is sent", async () => {
    const res = mockResponse();
    await auth.logout(mockRequest(), res);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("revokes every session of the admin", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    const res = mockResponse();
    await auth.logoutAll(mockRequest({ admin: { id: 1 } }), res);
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({ adminId: 1, revokedAt: null });
    expect(res.json.mock.calls[0][0].message).toContain("3 session(s)");
  });
});

describe("register", () => {
  const body = { nom: "Admin", email: ADMIN.email, motDePasse: "Secret123" };

  it("returns 409 when the email is taken", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(ADMIN);
    const res = mockResponse();
    await auth.register(mockRequest({ body }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("hashes the password before saving", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed");
    prisma.administrateur.create.mockResolvedValue({ id: 2, nom: "Admin", email: ADMIN.email });
    const res = mockResponse();

    await auth.register(mockRequest({ body }), res);

    expect(bcrypt.hash).toHaveBeenCalledWith("Secret123", 12);
    expect(prisma.administrateur.create).toHaveBeenCalledWith({ data: { ...body, motDePasse: "hashed" } });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("getProfil", () => {
  it("returns 404 when the admin no longer exists", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(null);
    const res = mockResponse();
    await auth.getProfil(mockRequest({ admin: { id: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("updateProfil", () => {
  const body = { nom: "Nouveau", email: "new@test.tn" };

  it("returns 409 when the email belongs to another admin", async () => {
    prisma.administrateur.findUnique.mockResolvedValue({ id: 99 });
    const res = mockResponse();
    await auth.updateProfil(mockRequest({ body, admin: { id: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("does not change the password when none is sent", async () => {
    prisma.administrateur.findUnique.mockResolvedValue({ id: 1 });
    prisma.administrateur.update.mockResolvedValue({ id: 1, ...body });
    const res = mockResponse();

    await auth.updateProfil(mockRequest({ body, admin: { id: 1 } }), res);

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prisma.administrateur.update.mock.calls[0][0].data).toEqual(body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("hashes the new password when sent", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed");
    const res = mockResponse();

    await auth.updateProfil(mockRequest({ body: { ...body, motDePasse: "Secret123" }, admin: { id: 1 } }), res);

    expect(prisma.administrateur.update.mock.calls[0][0].data.motDePasse).toBe("hashed");
  });
});

describe("updatePassword", () => {
  const body = { ancienMotDePasse: "Old12345", nouveauMotDePasse: "New12345" };

  it("returns 401 when the old password is wrong", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(ADMIN);
    bcrypt.compare.mockResolvedValue(false);
    const res = mockResponse();
    await auth.updatePassword(mockRequest({ body, admin: { id: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.administrateur.update).not.toHaveBeenCalled();
  });

  it("updates the password and revokes all sessions", async () => {
    prisma.administrateur.findUnique.mockResolvedValue(ADMIN);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue("hashed");
    const res = mockResponse();

    await auth.updatePassword(mockRequest({ body, admin: { id: 1 } }), res);

    expect(prisma.administrateur.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { motDePasse: "hashed" } });
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({ adminId: 1, revokedAt: null });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
