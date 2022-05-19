const Jimp = require('jimp');
const fs = require('fs');
const pathToFfmpeg = require('ffmpeg-static');
const util = require('util');

const exec = util.promisify(require('child_process').exec);

// Video editor settings
const videoEncoder = 'h264';
const inputFile = 'input.mp4';
const outputFile = 'output.mp4';

const inputFolder = 'temp/raw-frames';
const outputFolder = 'temp/edited-frames';

let currentProgress = 0;

console.log('here');

(async function () {
	try {
		//create temporary folders
		console.log('initialize temp files');
		await fs.mkdirSync('temp');
		await fs.mkdirSync(inputFolder);
		await fs.mkdirSync(outputFolder);

		//decode MP4 video and resize it to with 1080 and height auto
		console.log('decoding');

		await exec(`"${pathToFfmpeg}" -i ${inputFile} ${inputFolder}/%d.png`);

		//Edit each frame
		console.log('rendering');
		const frames = fs.readdirSync(inputFolder);

		for (let frameCount = 1; frameCount <= frames.length; frameCount++) {
			//check and log progress
			checkProgress(frameCount, frames.length);

			//read current frame
			let frame = await Jimp.read(`${inputFolder}/${frameCount}.png`);

			//modify frame
			frame = await modifyFrame(frame);

			//save the frame
			await frame.writeAsync(`${outputFolder}/${frameCount}.png`);
		}

		//encoding video to mp4 (no audio)
		console.log('encoding');
		await exec(
			`"${pathToFfmpeg}" -start_number 1 -i ${outputFolder}/%d.png -vcodec ${videoEncoder} -pix_fmt yuv420p temp/no-audio.mp4`,
		);

		//copy audio from original video
		console.log('adding audio');
		await exec(
			`"${pathToFfmpeg}" -i temp/no-audio.mp4 -i ${inputFile} -c copy -map 0:v:0 -map 1:a:0? ${outputFile}`,
		);

		//remove temp folder
		console.log('cleaning up');
		await fs.remove('temp');
	} catch (e) {
		console.log(`An error occurred: ${e}`);

		//remove temp folder
		console.log('cleaning up');
		await fs.remove('temp');
	}
})();

const modifyFrame = async (frame) => {
	frame.rotate(-90);

	frame.crop(0, 270, frame.bitmap.width, frame.bitmap.width);

	return frame;
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

// const t = async () => {
// 	let frame = await Jimp.read(`${inputFolder}/${1}.png`);

// 	//modify frame
// 	// frame = await modifyFrame(frame);

// 	//save the frame
// 	frame.writeAsync(`${outputFolder}/${1}.png`);
// };

// t();
