const Jimp = require('jimp');
const fs = require('fs');
const pathToFfmpeg = require('ffmpeg-static');
const util = require('util');
const path = require('path');

const exec = util.promisify(require('child_process').exec);

// Video editor settings
const videoEncoder = 'h264';
const inputFile = 'input.mp4';
const outputFile = 'output.mp4';
const targetImg = 'target.png';

const inputFolder = 'temp/raw-frames';
const outputFolder = 'temp/edited-frames';

let currentProgress = 0;

// (async function () {
// 	try {
// 		//create temporary folders
// 		console.log('initialize temp files');
// 		await fs.mkdirSync('temp');
// 		await fs.mkdirSync(inputFolder);
// 		await fs.mkdirSync(outputFolder);

// 		//decode MP4 video and resize it to with 1080 and height auto
// 		console.log('decoding');

// 		await exec(`"${pathToFfmpeg}" -i ${inputFile} ${inputFolder}/%d.png`);

// 		//Edit each frame
// 		console.log('rendering');
// 		const frames = fs.readdirSync(inputFolder);

// 		for (let frameCount = 1; frameCount <= frames.length; frameCount++) {
// 			//check and log progress
// 			checkProgress(frameCount, frames.length);

// 			//read current frame
// 			let frame = await Jimp.read(`${inputFolder}/${frameCount}.png`);

// 			//modify frame
// 			frame = await modifyFrame(frame);

// 			//save the frame
// 			await frame.writeAsync(`${outputFolder}/${frameCount}.png`);
// 		}

// 		//encoding video to mp4 (no audio)
// 		console.log('encoding');
// 		await exec(
// 			`"${pathToFfmpeg}" -start_number 1 -i ${outputFolder}/%d.png -vcodec ${videoEncoder} -pix_fmt yuv420p temp/no-audio.mp4`,
// 		);

// 		//copy audio from original video
// 		console.log('adding audio');
// 		await exec(
// 			`"${pathToFfmpeg}" -i temp/no-audio.mp4 -i ${inputFile} -c copy -map 0:v:0 -map 1:a:0? ${outputFile}`,
// 		);

// 		//remove temp folder
// 		console.log('cleaning up');
// 		await fs.remove('temp');
// 	} catch (e) {
// 		console.log(`An error occurred: ${e}`);

// 		//remove temp folder
// 		console.log('cleaning up');
// 		await fs.remove('temp');
// 	}
// })();

const modifyFrame = async (frame) => {
	let target = await Jimp.read(targetImg);

	frame.rotate(-90);
	frame.crop(0, 250, frame.bitmap.width, frame.bitmap.width);
	frame.resize(target.bitmap.width, target.bitmap.height, Jimp.RESIZE_BEZIER);

	target.composite(frame, 0, 0, {
		mode: Jimp.BLEND_OVERLAY,
		opacitySource: 0.5,
		opacityDest: 0.9,
	});

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

{
	/* <shot counter="1" TC_FrameIndex="936" FFC_FrameIndex="441" time="14.699999999999999"   TargetX="200"  TargetY="275"/> */
}

const t = async () => {
	// await deleteFolderRecursive('temp');
	let target = await Jimp.read(targetImg);

	let frame = await Jimp.read(`${1}.png`);

	let triangle = new Jimp(15, 15, 0xff0000ff, (err, image) => {
		// this image is 256 x 256, every pixel is set to 0xFF0000FF
	});

	const font = await Jimp.loadFont(Jimp.FONT_SANS_12_BLACK);

	triangle.print(font, 3.5, -1, 'A');

	triangle.circle();

	frame.resize(target.bitmap.width, target.bitmap.height, Jimp.RESIZE_BEZIER);

	target.composite(frame, 0, 0, {
		mode: Jimp.BLEND_OVERLAY,
		opacitySource: 0.5,
		opacityDest: 0.9,
	});
	target.composite(triangle, 200, 275, {
		mode: Jimp.BLEND_SOURCE_OVER,
		opacitySource: 1,
		opacityDest: 1,
	});

	// 	// 	//modify frame
	// 	// 	// frame = await modifyFrame(frame);

	// 	// save the frame
	target.writeAsync(`${11}.png`);
};

t();
