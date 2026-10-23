const jwt = require("jsonwebtoken");
const authMiddleware = require("../../../middelwhere/auth.middleware");
const { mockRequest, mockResponse } = require("../../helpers/http");

const SECRET = "test-secret";

describe("authMiddleware", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it("returns 401 when the Authorization header is missing", () => {
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(mockRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the header has no token", () => {
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(mockRequest({ headers: { authorization: "Bearer" } }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for an invalid token", () => {
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(mockRequest({ headers: { authorization: "Bearer abc.def.ghi" } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for a token signed with another secret", () => {
    const token = jwt.sign({ id: 1 }, "autre-secret");
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(mockRequest({ headers: { authorization: `Bearer ${token}` } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 for an expired token", () => {
    const token = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(mockRequest({ headers: { authorization: `Bearer ${token}` } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("sets req.admin and calls next for a valid token", () => {
    const token = jwt.sign({ id: 7, email: "admin@test.tn" }, SECRET);
    const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toMatchObject({ id: 7, email: "admin@test.tn" });
    expect(res.status).not.toHaveBeenCalled();
  });
});
