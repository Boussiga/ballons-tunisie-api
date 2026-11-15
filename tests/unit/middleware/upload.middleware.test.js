jest.mock("../../../config/cloudinary", () => ({
  cloudinary: { uploader: { upload_stream: jest.fn(), destroy: jest.fn().mockResolvedValue({}) } },
  FOLDER: "ballons-tunisie/produits",
  isConfigured: jest.fn(() => true),
}));

const { cloudinary, isConfigured } = require("../../../config/cloudinary");
const {
  uploadToCloudinary, supprimerEnvois, deleteImage, publicIdFromUrl, detectImageType,
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
  const URL_A = "https://res.cloudinary.com/x/image/upload/v1/ballons-tunisie/produits/a.png";
  // Each upload answers with a url/public_id built from its call number, or fails when asked
  const cloudinaryRepond = (echecs = []) => {
    let n = 0;
    cloudinary.uploader.upload_stream.mockImplementation((opts, cb) => {
      const i = n++;
      return {
        end: () => (echecs.includes(i)
          ? cb(new Error("secret detail"))
          : cb(null, { secure_url: URL_A.replace("a.png", `img${i}.png`), public_id: `ballons-tunisie/produits/img${i}` })),
      };
    });
  };

  it("calls next without files", async () => {
    const next = jest.fn();
    await uploadToCloudinary({ files: [] }, mockResponse(), next);
    await uploadToCloudinary({}, mockResponse(), next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });

  it("returns 503 when Cloudinary is not configured", async () => {
    isConfigured.mockReturnValue(false);
    const res = mockResponse();
    await uploadToCloudinary({ files: [{ buffer: PNG }] }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("uploads every file and exposes url + publicId on each", async () => {
    cloudinaryRepond();
    const req = { files: [{ buffer: PNG }, { buffer: JPG }, { buffer: WEBP }] };
    const next = jest.fn();
    await uploadToCloudinary(req, mockResponse(), next);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(3);
    const opts = cloudinary.uploader.upload_stream.mock.calls[0][0];
    expect(opts.folder).toBe("ballons-tunisie/produits");
    expect(opts.allowed_formats).toEqual(["jpg", "jpeg", "png", "webp"]);
    expect(req.files.map((f) => f.publicId)).toEqual([0, 1, 2].map((i) => `ballons-tunisie/produits/img${i}`));
    expect(req.files[0].url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(next).toHaveBeenCalled();
  });

  it("all or nothing: one failure removes the uploaded ones, returns 502 and hides details", async () => {
    cloudinaryRepond([1]);
    const res = mockResponse();
    const next = jest.fn();
    await uploadToCloudinary({ files: [{ buffer: PNG }, { buffer: PNG }, { buffer: PNG }] }, res, next);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(next).not.toHaveBeenCalled();
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/secret detail/);
    const supprimees = cloudinary.uploader.destroy.mock.calls.map((c) => c[0]).sort();
    expect(supprimees).toEqual(["ballons-tunisie/produits/img0", "ballons-tunisie/produits/img2"]);
  });
});

describe("supprimerEnvois", () => {
  it("removes the uploaded files of a failed request", async () => {
    await supprimerEnvois([{ publicId: "p/a" }, { publicId: "p/b" }]);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
    await expect(supprimerEnvois(undefined)).resolves.toEqual([]);
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
