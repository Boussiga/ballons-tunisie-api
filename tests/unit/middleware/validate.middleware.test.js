const { z } = require("zod");
const { validate, intIdParam, uuidParam, paginationQuery } = require("../../../validations/validate.middleware");
const { mockRequest, mockResponse } = require("../../helpers/http");

describe("validate middleware", () => {
  const schemas = {
    body: z.object({ nom: z.string().min(2).trim() }),
    params: intIdParam,
    query: paginationQuery,
  };

  it("replaces req with parsed data and calls next when everything is valid", () => {
    const req = mockRequest({ body: { nom: "  Ballon  " }, params: { id: "12" }, query: { page: "2" } });
    const res = mockResponse();
    const next = jest.fn();

    validate(schemas)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ nom: "Ballon" });
    expect(req.params).toEqual({ id: 12 });
    expect(req.query).toEqual({ page: 2, limit: 10 });
  });

  it("returns 422 with every error, prefixed by its location", () => {
    const req = mockRequest({ body: { nom: "a" }, params: { id: "abc" }, query: { limit: "500" } });
    const res = mockResponse();
    const next = jest.fn();

    validate(schemas)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    const { message, erreurs } = res.json.mock.calls[0][0];
    expect(message).toBe("Données invalides.");
    expect(erreurs.map((e) => e.champ)).toEqual(["nom", "params.id", "query.limit"]);
  });

  it("uses 'body' as field name for a root-level body error", () => {
    const req = mockRequest({ body: "pas un objet" });
    const res = mockResponse();

    validate({ body: z.object({}) })(req, res, jest.fn());

    expect(res.json.mock.calls[0][0].erreurs[0].champ).toBe("body");
  });

  it("ignores locations without schema", () => {
    const req = mockRequest({ body: { anything: true } });
    const next = jest.fn();

    validate({})(req, mockResponse(), next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ anything: true });
  });
});

describe("uuidParam", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(uuidParam.safeParse({ id: "3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b" }).success).toBe(true);
    expect(uuidParam.safeParse({ id: "12" }).success).toBe(false);
  });
});

describe("paginationQuery", () => {
  it("applies defaults", () => {
    expect(paginationQuery.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it("rejects page < 1 and limit > 100", () => {
    expect(paginationQuery.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationQuery.safeParse({ limit: "101" }).success).toBe(false);
  });
});
