jest.mock("../../../config/cloudinary", () => ({
  cloudinary: { uploader: { upload_stream: jest.fn(), destroy: jest.fn().mockResolvedValue({}) } },
  FOLDER: "ballons-tunisie/produits",
  isConfigured: jest.fn(() => true),
}));

const { cloudinary, isConfigured } = require("../../../config/cloudinary");
const {
  uploadToCloudinary, deleteImage, publicIdFromUrl, detectImageType,
} = require("../../../middelwhere/upload.middleware");
const { mockResponse } = require("../../helpers/http");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);

beforeEach(() => { jest.clearAllMocks(); isConfigured.mockReturnValue(true); });

describe("detectImageType", () => {
  it("recognises png/jpeg/webp by signature", () => {
    expect(detectImageType(PNG)).toBe("png");
    expect(detectImageType(JPG)).toBe("jpeg");
    expect(detectImageType(WEBP)).toBe("webp");
  });
  it("rejects html/svg disguised as an image", () => {
    expect(detectImageType(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(detectImageType(Buffer.from("<html><script>x</script></html>"))).toBeNull();
    expect(detectImageType(null)).toBeNull();
  });
});

describe("uploadToCloudinary", () => {
  it("calls next without a file", () => {
    const next = jest.fn();
    uploadToCloudinary({}, mockResponse(), next);
    expect(next).toHaveBeenCalled();
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it("returns 503 when Cloudinary is not configured", () => {
    isConfigured.mockReturnValue(false);
    const res = mockResponse();
    uploadToCloudinary({ file: { buffer: PNG } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("uploads the buffer and exposes url + publicId", () => {
    const end = jest.fn();
    cloudinary.uploader.upload_stream.mockImplementation((opts, cb) => {
      expect(opts.folder).toBe("ballons-tunisie/produits");
      expect(opts.allowed_formats).toEqual(["jpg", "jpeg", "png", "webp"]);
      return { end: (buf) => { end(buf); cb(null, { secure_url: "https://res.cloudinary.com/x/image/upload/v1/ballons-tunisie/produits/a.png", public_id: "ballons-tunisie/produits/a" }); } };
    });
    const req = { file: { buffer: PNG } };
    const next = jest.fn();
    uploadToCloudinary(req, mockResponse(), next);
    expect(end).toHaveBeenCalledWith(PNG);
    expect(req.file.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(req.file.publicId).toBe("ballons-tunisie/produits/a");
    expect(next).toHaveBeenCalled();
  });

  it("returns 502 and hides details when Cloudinary fails", () => {
    cloudinary.uploader.upload_stream.mockImplementation((o, cb) => ({ end: () => cb(new Error("secret detail")) }));
    const res = mockResponse();
    uploadToCloudinary({ file: { buffer: PNG } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(502);
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/secret detail/);
  });
});

describe("publicIdFromUrl / deleteImage", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v1699999999/ballons-tunisie/produits/abc123.jpg";
  it("extracts the public_id", () => {
    expect(publicIdFromUrl(url)).toBe("ballons-tunisie/produits/abc123");
  });
  it("ignores foreign / legacy urls", () => {
    expect(publicIdFromUrl("/uploads/123.png")).toBeNull();
    expect(publicIdFromUrl("https://evil.com/a.png")).toBeNull();
    expect(publicIdFromUrl(null)).toBeNull();
  });
  it("destroys the image and never throws", async () => {
    await deleteImage(url);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("ballons-tunisie/produits/abc123", { resource_type: "image" });
    cloudinary.uploader.destroy.mockRejectedValueOnce(new Error("boom"));
    await expect(deleteImage(url)).resolves.toBeUndefined();
  });
  it("does nothing for legacy local urls", async () => {
    await deleteImage("/uploads/old.png");
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
