const Jimp = require('jimp');
const fs = require('fs');
const pathToFfmpeg = require('ffmpeg-static');
const util = require('util');
const path = require('path');
const xml2js = require('xml2js');

const exec = util.promisify(require('child_process').exec);
const parser = new xml2js.Parser();

// Video editor settings
const videoEncoder = 'h264';
const inputFile = 'input.mp4';
const outputFile = 'output.mp4';
const targetImg = 'target.png';

const inputFolder = 'temp/raw-frames';
const outputFolder = 'temp/edited-frames';

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
		console.log('initialize temp files');
		await fs.mkdirSync('temp');
		await fs.mkdirSync(inputFolder);
		await fs.mkdirSync(outputFolder);
		const file = await fs.readFileSync(
			`${__dirname}/FFC_1635778524164__0.mp4.xml`,
			() => {},
		);

		const { Set } = await parser.parseStringPromise(file);

		const data = Set.Shots[0].shot.map(({ $ }) => $);
		// console.log(Set);

		let firstShot = false;

		const editedFrames = data.map((obj) => +obj.FFC_FrameIndex);
		const startEndFrames = +Set.StartEndFrames[0] / 30;
		const shotFrames = +Set.ShotFrames[0];

		// console.log(editedFrames);

		const emptyArray = new Array(editedFrames.length).fill(null);

		const newShotArr = emptyArray.reduce((acc, _, index) => {
			index === 0
				? acc.push(shotFrames)
				: acc.push(acc[index - 1] + shotFrames * 2);
			return acc;
		}, []);

		const newData = data.map((obj, i) => ({
			...obj,
			FFC_FrameIndex: newShotArr[i],
		}));

		const getFirstShot = (num) => {
			firstShot = shotFrames === num;
		};

		//decode MP4 video and resize it to with 1080 and height auto
		console.log('decoding');

		const isLess = (frame, nextFrame) => {
			return frame
				? nextFrame - shotFrames < frame + shotFrames
					? frame
					: nextFrame - shotFrames
				: nextFrame - shotFrames;
		};

		const cutFrames = () => {
			let str = '';
			editedFrames.forEach((frame, i) => {
				const between = i === 0 ? 'between' : '+between';
				const framelast = editedFrames[i - 1] + shotFrames;
				const frameStart = isLess(framelast, frame);
				str += `${between}(n\,${frameStart}, ${frame + shotFrames})`;
			});
			return str;
		};

		await exec(
			`"${pathToFfmpeg}" -ss ${startEndFrames} -i newvideo.mp4 -an -vf "select='${cutFrames()}',setpts=PTS-STARTPTS" ${inputFolder}/%d.png`,
		);

		//Edit each frame
		console.log('rendering');
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
				newData,
				frameCount,
			);

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
		await deleteFolderRecursive('temp');
	} catch (e) {
		console.log(`An error occurred: ${e}`);

		//remove temp folder
		console.log('cleaning up');
		await deleteFolderRecursive('temp');
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
		// console.log(obj, frame);
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

// const t = String.fromCharCode(64 + 1);
// const {
// 	Shots: { shot },
// } = await parser.parseStringPromise(file);

// const data = shot.map(({ $ }) => $);

// {
// 	/* <shot counter="1" TC_FrameIndex="936" FFC_FrameIndex="441" time="14.699999999999999"   TargetX="200"  TargetY="275"/> */
// }

// const t = async () => {
// 	// await deleteFolderRecursive('temp');

// 	const file = await fs.readFileSync(
// 		`${__dirname}/FFC_1635778524164__0.mp4.xml`,
// 		() => {},
// 	);

// 	const {
// 		Shots: { shot },
// 	} = await parser.parseStringPromise(file);

// 	console.log(shot);

// 	let target = await Jimp.read(targetImg);

// 	let frame = await Jimp.read(`${1}.png`);

// 	let triangle = new Jimp(15, 15, 0xff0000ff, (err, image) => {
// 		// this image is 256 x 256, every pixel is set to 0xFF0000FF
// 	});

// 	const font = await Jimp.loadFont(Jimp.FONT_SANS_12_BLACK);

// 	triangle.print(font, 3.5, -1, 'A');

// 	triangle.circle();

// 	frame.resize(target.bitmap.width, target.bitmap.height, Jimp.RESIZE_BEZIER);

// 	target.composite(frame, 0, 0, {
// 		mode: Jimp.BLEND_OVERLAY,
// 		opacitySource: 0.5,
// 		opacityDest: 0.9,
// 	});
// 	target.composite(triangle, 200, 275, {
// 		mode: Jimp.BLEND_SOURCE_OVER,
// 		opacitySource: 1,
// 		opacityDest: 1,
// 	});

// 	// 	// 	//modify frame
// 	// 	// 	// frame = await modifyFrame(frame);

// 	// 	// save the frame
// 	target.writeAsync(`${11}.png`);
// };

// t();
