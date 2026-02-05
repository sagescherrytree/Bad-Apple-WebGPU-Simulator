import Stats from 'stats.js';
import { GUI } from 'dat.gui';
import { GPUContext } from './core/GPUContext.js';
import { FrameLoop } from './core/frameLoop.js';
import { VideoSource } from './video/videoSource.js';

// Initialise GPU Context in main.ts because all we use is video input.
async function main() {
    const gpu = GPUContext.getInstance();
    await gpu.init("canvas");

    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const video = new VideoSource(
        gpu.device,
        480,
        360,
        "badApple.mp4"
    );

    const frameLoop = new FrameLoop(
        (dt) => {
            stats.begin();
            video.update(gpu.device);
        },
        () => {
            // render pass goes here
            stats.end();
        }
    );

    frameLoop.start();
}

main();
