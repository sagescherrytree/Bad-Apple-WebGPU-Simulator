import Stats from 'stats.js';

import { GPUContext } from './core/GPUContext.js';
import { FrameLoop } from './core/frameLoop.js';
import { VideoSource } from './video/videoSource.js';
import { VideoThresholdPass } from './video/videoThresholdPass.js';
// import { ClearPass } from "./render/clearPass";
import { FullscreenVideoPass } from './render/fullScreenVideoPass.js';

// Rendering pipeline:
// video -> videoThresholdPass (binaryTexture) -> fullScreenBinaryPass -> screen o/p.

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

    // Take in the video!
    const videoPass = new FullscreenVideoPass(
        gpu.device,
        gpu.format,
        video.texture,
        video.sampler
    );

    // Take in video threshold pass to convert to binary texture.
    const thresholdPass = new VideoThresholdPass(
        gpu.device,
        video.texture,
        video.sampler,
        480, // Width.
        360 // Height.
    );

    // Debug fullscreen pass to verify that binary texture working.
    const binaryDebugPass = new FullscreenVideoPass(
        gpu.device,
        gpu.format,
        thresholdPass.binaryTexture,
        video.sampler
    );

    // In frame loop, update threshold pass as well.
    const frameLoop = new FrameLoop(
        (dt) => {
            time += dt;
            video.update(gpu.device);
            thresholdPass.dispatch(gpu.device);
        },
        () => {
            binaryDebugPass.render(gpu.device, gpu.context);
            // videoPass.render(gpu.device, gpu.context);
        }
    );

    // A start button XD.
    const startButton = document.createElement("button");
    startButton.textContent = "Click to Start Video";
    startButton.style.position = "absolute";
    startButton.style.top = "50%";
    startButton.style.left = "50%";
    startButton.style.transform = "translate(-50%, -50%)";
    startButton.style.fontSize = "24px";
    startButton.style.padding = "12px 24px";
    document.body.appendChild(startButton);

    startButton.addEventListener("click", async () => {
        document.body.removeChild(startButton);
        await video.video.play(); // This now works
        frameLoop.start();        // Start rendering loop
    }, { once: true });
}

main();
