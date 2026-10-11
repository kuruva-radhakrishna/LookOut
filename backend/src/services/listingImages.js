const AppError = require("../utils/AppError");

const MAX_IMAGES = 10;

/**
 * Turns the client's image list into what we store: [{ url, filename, credit?, license?, source?, primary }] with
 * exactly one primary (index `primary`, default the first). Attribution on photos the listing already has is kept,
 * matched by URL, so editing a listing never loses a photographer's credit.
 */
function normalizeImages(input, primaryIndex = 0, existing = []) {
  const known = new Map(existing.filter((e) => e?.url).map((e) => [e.url, e]));
  const primaryUrl = input[primaryIndex]?.url; // remember WHICH photo was chosen; indexes shift when duplicates are dropped
  const seen = new Set();
  const images = [];
  input.forEach((item) => {
    if (seen.has(item.url)) return; // the same photo twice is just noise
    seen.add(item.url);
    const prior = known.get(item.url);
    images.push({
      url: item.url,
      filename: item.filename || prior?.filename || "external",
      ...(prior?.credit && { credit: prior.credit, license: prior.license, source: prior.source }),
    });
  });
  if (!images.length) throw new AppError(400, "Please add at least one photo");
  if (images.length > MAX_IMAGES) throw new AppError(400, `A listing can have at most ${MAX_IMAGES} photos`);
  const found = images.findIndex((img) => img.url === primaryUrl);
  const p = found >= 0 ? found : 0; // no / invalid choice: the first photo
  images.forEach((img, i) => (img.primary = i === p));
  return images;
}

/** The primary photo in the shape the rest of the app reads as `listing.img`. */
const primaryOf = (images) => {
  const { primary, ...img } = images.find((i) => i.primary) || images[0]; // eslint-disable-line no-unused-vars
  return img;
};

/** For responses: always an `images` array, primary first. Listings created before galleries only have `img`. */
function withImages(listing) {
  const images = listing.images?.length ? listing.images : listing.img?.url ? [{ ...listing.img, primary: true }] : [];
  const ordered = [...images].sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
  return { ...listing, images: ordered.map((i, n) => ({ ...i, _id: i._id || `legacy-${n}` })) };
}

module.exports = { MAX_IMAGES, normalizeImages, primaryOf, withImages };
