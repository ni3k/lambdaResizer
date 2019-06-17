"use strict";
const AWS = require("aws-sdk");
const util = require("util");
const gm = require("gm").subClass({ imageMagick: true });
const imagemin = require("imagemin");
const imageminPngquant = require("imagemin-pngquant");
const s3 = new AWS.S3();
/*
This regexes helps identify the size patterns:
WxHxXparamxYparam
Or
700x700xOxO
700x700_1800x1800
700x700-1800x1800
500x500_700x700-1800x1800
*/
const cropRegex = /(\d+x\d+x\d+x\d+(-|_)?)+/;

const resizeRegex = /(\d+x\d+(-|_)?)+/;
const IMG_EXTENSION = "PNG";
const SRC_FOLDER = "originals/";
const DEST_FOLDER = "processed/";
const DEST_BUCKET = process.env.BUCKET;
module.exports.handler = async event => {
  log("Reading options from event:\n", util.inspect(event, { depth: 5 }));
  const { s3: s3Obj } = event.Records[0];
  const srcBucket = s3Obj.bucket.name;
  const srcKey = decodeURIComponent(s3Obj.object.key.replace(/\+/g, " "));
  const absoluteImagePath = `${srcBucket}/${srcKey}`;
  // Get the sizes encoded in the path of the image
  const cropMatch = srcKey.match(cropRegex);
  const resizeMatch = srcKey.match(resizeRegex);

  if (!cropMatch && !resizeMatch) throw Error(`Size not specified for file: ${absoluteImagePath}`);
  log(`Getting image from S3: ${absoluteImagePath}`);
  const response = await s3.getObject({ Bucket: srcBucket, Key: srcKey }).promise();
  let sizes;
  if (!cropMatch) {
    sizes = resizeMatch[0].split(/-|_/);
  } else {
    sizes = cropMatch[0].split(/-|_/);
  }
  for (const size of sizes) {
    log(`Resizing image to size: ${size}`);
    const [width, height, xParam = 0, yParam = 0] = getWidthAndHeightFromSize(size);
    const resizedImage = await resizeImage({
      content: response.Body,
      IMG_EXTENSION,
      width,
      height,
      xParam,
      yParam
    });
    log("Compressing image. Quality: 65-80");
    const compressedImage = await imagemin.buffer(resizedImage, {
      plugins: [imageminPngquant({ quality: [0.65, 0.8] })]
    });
    let dstKey;
    if (!cropRegex) {
      dstKey = srcKey.split(SRC_FOLDER)[1].replace(resizeRegex, size);
    } else {
      dstKey = srcKey.split(SRC_FOLDER)[1].replace(cropRegex, size);
    }
    log(`Uploading processed image to: ${dstKey}`);
    await s3
      .putObject({
        Bucket: DEST_BUCKET,
        Key: `${DEST_FOLDER}${dstKey}`,
        Body: compressedImage,
        ContentType: response.ContentType
      })
      .promise();
  }
  log(`Successfully processed ${srcBucket}/${srcKey}`);
};
function log(...args) {
  console.log(...args);
}
function getWidthAndHeightFromSize(size) {
  return size.split("x");
}
function resizeImage({ width, height, imgExtension, content, xParam, yParam }) {
  return new Promise((resolve, reject) => {
    if (!xParam && !yParam) {
      gm(content)
        .resize(width, height)
        .toBuffer(imgExtension, function(err, buffer) {
          if (err) reject(err);
          else resolve(buffer);
        });
    } else {
      gm(content)
        .crop(width, height, xParam, yParam)
        .toBuffer(imgExtension, function(err, buffer) {
          if (err) reject(err);
          else resolve(buffer);
        });
    }
  });
}
