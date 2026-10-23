// Minimal Express req/res doubles for calling controllers and middlewares directly

const mockRequest = ({ body = {}, params = {}, query = {}, headers = {}, admin } = {}) => ({
  body,
  params,
  query,
  headers,
  ...(admin && { admin }),
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

module.exports = { mockRequest, mockResponse };
