import Stats from 'stats.js';

import { GPUContext } from './core/GPUContext.js';
import { FrameLoop } from './core/frameLoop.js';
import { VideoSource } from './video/videoSource.js';
import { VideoThresholdPass } from './video/videoThresholdPass.js';
import { InitVectorSeedPass } from './jfa/initVectorSeed.js';
import { JumpFloodAlgorithm } from './jfa/jfaPass.js';
import { VectorFieldDebug } from './jfa/jfaPass.js';
// import { ClearPass } from "./render/clearPass";
// import { FullscreenVideoPass } from './render/fullScreenVideoPass.js';

// Rendering pipeline:
// video -> videoThresholdPass (binaryTexture) -> fullScreenBinaryPass -> screen o/p.

const WIDTH = 480;
const HEIGHT = 360;

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
        WIDTH,
        HEIGHT,
        "badApple.mp4"
    );

    // Take in the video!
    // const videoPass = new FullscreenVideoPass(
    //     gpu.device,
    //     gpu.format,
    //     video.texture,
    //     video.sampler
    // );

    // Take in video threshold pass to convert to binary texture.
    const thresholdPass = new VideoThresholdPass(
        gpu.device,
        video.texture,
        video.sampler,
        WIDTH,
        HEIGHT
    );

    // Create pingpong textures for vector field generation and JFA.
    const vectorTextureA = gpu.device.createTexture({
        size: [WIDTH, HEIGHT],
        format: "rgba32float",
        usage:
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.COPY_DST,
    });

    const vectorTextureB = gpu.device.createTexture({
        size: [WIDTH, HEIGHT],
        format: "rgba32float",
        usage:
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.COPY_DST,
    });

    // Create vector field.
    const initVecPass = new InitVectorSeedPass(
        gpu.device,
        thresholdPass.binaryTexture,
        vectorTextureA // Initial vector field map goes to first pingpong texture.
    );

    // JFA pass.
    const jfaPass = new JumpFloodAlgorithm(gpu.device);

    // Debug fullscreen pass to verify that binary texture working.
    // const binaryDebugPass = new FullscreenVideoPass(
    //     gpu.device,
    //     gpu.format,
    //     thresholdPass.binaryTexture,
    //     video.sampler
    // );

    // Canvas size.
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;

    // Get the displayed size in pixels
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Debug pass for vector field.
    const vectorFieldDebugPass = new VectorFieldDebug(
        gpu.device,
        vectorTextureA,
        gpu.format
    );

    // In frame loop, update threshold pass as well.
    const frameLoop = new FrameLoop(
        (dt) => {
            time += dt;
            video.update(gpu.device);
            thresholdPass.dispatch(gpu.device);
            // Vector field init pass.
            initVecPass.dispatch(gpu.device, WIDTH, HEIGHT);
            // Multiple iterations of JFA.
            const maxDim = Math.max(WIDTH, HEIGHT);
            let step = Math.floor(maxDim / 2);

            while (step >= 1) {
                jfaPass.dispatch(gpu.device, WIDTH, HEIGHT, vectorTextureA, vectorTextureB);
                step = Math.floor(step / 2);
            }

            const finalTexture = jfaPass.getFinalTexture(vectorTextureA, vectorTextureB, WIDTH, HEIGHT);
            vectorFieldDebugPass.vectorTexture = finalTexture;
            //jfaPass.dispatch(gpu.device, WIDTH, HEIGHT, vectorTextureA, vectorTextureB);
        },
        () => {
            vectorFieldDebugPass.render(gpu.device, gpu.context);
            //binaryDebugPass.render(gpu.device, gpu.context);
            //videoPass.render(gpu.device, gpu.context);
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
