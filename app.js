const Jimp = require("jimp");
const fs = require("fs");
const pathToFfmpeg = require("ffmpeg-static");
const util = require("util");
const path = require("path");
const xml2js = require("xml2js");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");

const exec = util.promisify(require("child_process").exec);
const parser = new xml2js.Parser();

// Video editor settings
const videoEncoder = "h264";
const inputFile = "input.mp4";
const outputFile = "output.mp4";
const targetImg = "target.png";

const inputFolder = "temp/raw-frames";
const outputFolder = "temp/edited-frames";

let currentProgress = 0;

const deleteFolderRecursive = function (directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
};

(async function () {
  try {
    //create temporary folders
    console.log("initialize temp files");
    await fs.mkdirSync("temp");
    await fs.mkdirSync(inputFolder);
    await fs.mkdirSync(outputFolder);
    const file = await fs.readFileSync(
      `${__dirname}/FFC_1635778524164__0.mp4.xml`,
      () => {}
    );

    const { Set } = await parser.parseStringPromise(file);

    const data = Set.Shots[0].shot.map(({ $ }) => $);
    console.log(Set);

    let firstShot = false;

    const editedFrames = data.map((obj) => +obj.FFC_FrameIndex);
    const startEndFrames = Set.StartEndFrames[0] / 25;
    const shotFrames = +Set.ShotFrames[0];

    console.log(editedFrames);

    const getDataFrames = [];

    const getFirstShot = (num) =>
      (firstShot = data.find((obj) => +obj.FFC_FrameIndex === num));

    //decode MP4 video and resize it to with 1080 and height auto
    console.log("decoding");

    const t = await ffmpeg.ffprobe(inputFile, (err, metaData) => {
      console.log("metaData", metaData);
    });

    // await exec(
    //   `"${pathToFfmpeg}" -ss ${startEndFrames} -sseof ${startEndFrames}  -i ${inputFile} ${inputFolder}/%d.png`
    // );

    //Edit each frame
    console.log("rendering");
    const frames = fs.readdirSync(inputFolder);

    for (let frameCount = 1; frameCount <= frames.length; frameCount++) {
      //check and log progress
      checkProgress(frameCount, frames.length);

      //read current frame
      let frame = await Jimp.read(`${inputFolder}/${frameCount}.png`);

      //modify frame
      frame = await modifyFrame(
        frame,
        !firstShot ? getFirstShot(frameCount) : firstShot,
        data,
        frameCount
      );

      //save the frame
      await frame.writeAsync(`${outputFolder}/${frameCount}.png`);
    }

    //encoding video to mp4 (no audio)
    console.log("encoding");
    // await exec(
    //   `"${pathToFfmpeg}" -start_number 1 -i ${outputFolder}/%d.png -vcodec ${videoEncoder} -pix_fmt yuv420p temp/no-audio.mp4`
    // );

    //copy audio from original video
    console.log("adding audio");
    // await exec(
    //   `"${pathToFfmpeg}" -i temp/no-audio.mp4 -i ${inputFile} -c copy -map 0:v:0 -map 1:a:0? ${outputFile}`
    // );

    //remove temp folder
    console.log("cleaning up");
    await deleteFolderRecursive("temp");
  } catch (e) {
    console.log(`An error occurred: ${e}`);

    //remove temp folder
    console.log("cleaning up");
    await deleteFolderRecursive("temp");
  }
})();

const modifyFrame = async (frame, firstShot, data, frameCount) => {
  let triangle;
  let target = await Jimp.read(targetImg);

  frame.rotate(-90);
  frame.crop(0, 250, frame.bitmap.width, frame.bitmap.width);
  frame.resize(target.bitmap.width, target.bitmap.height, Jimp.RESIZE_BEZIER);

  target.composite(frame, 0, 0, {
    mode: Jimp.BLEND_OVERLAY,
    opacitySource: 0.5,
    opacityDest: 0.9,
  });

  target.composite(frame, 0, 0, {
    mode: Jimp.BLEND_OVERLAY,
    opacitySource: 0.5,
    opacityDest: 0.9,
  });
  if (firstShot) {
    const font = await Jimp.loadFont(Jimp.FONT_SANS_12_BLACK);

    data.forEach((obj) => {
      if (+obj.FFC_FrameIndex <= frameCount) {
        triangle = new Jimp(15, 15, 0xff0000ff, (err, image) => {
          // this image is 15 x 15, every pixel is set to 0xFF0000FF
        });
        triangle.circle();
        triangle.print(font, 3.5, -1, String.fromCharCode(64 + +obj.counter));
        target.composite(triangle, +obj.TargetX, +obj.TargetY, {
          mode: Jimp.BLEND_SOURCE_OVER,
          opacitySource: 1,
          opacityDest: 1,
        });
      }
    });
  }

  return target;
};

//Calculate the progress

const checkProgress = (currentFrame, totalFrame) => {
  const progress = (currentFrame / totalFrame) * 100;
  if (progress > currentProgress + 10) {
    const displayProgress = Math.floor(progress);
    console.log(`Progress: ${displayProgress}%`);
    currentProgress = displayProgress;
  }
};
