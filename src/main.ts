import Stats from 'stats.js';

import { GPUContext } from './core/GPUContext.js';
import { FrameLoop } from './core/frameLoop.js';
import { VideoSource } from './video/videoSource.js';
import { ClearPass } from "./render/clearPass";
import { FullscreenVideoPass } from './render/fullScreenVideoPass.js';

// Initialise GPU Context in main.ts because all we use is video input.
async function main() {
    const gpu = GPUContext.getInstance();
    await gpu.init("canvas");

    // const clearPass = new ClearPass();
    let time = 0;

    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const video = new VideoSource(
        gpu.device,
        480,
        360,
        "badApple.mp4"
    );

    const sampler = gpu.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
    });

    // Take in the video!
    const videoPass = new FullscreenVideoPass(
        gpu.device,
        gpu.format,
        video.texture,  // from your VideoSource
        sampler  // you should have a sampler in VideoSource
    );

    const frameLoop = new FrameLoop(
        (dt) => {
            time += dt;
            video.update(gpu.device);
        },
        () => {
            videoPass.render(gpu.device, gpu.context);
        }
    );


    frameLoop.start();
}

main();
