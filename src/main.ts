import Stats from 'stats.js';
import { GUI } from 'dat.gui';

import { GPUContext } from './core/GPUContext.js';
import { FrameLoop } from './core/frameLoop.js';
import { VideoSource } from './video/videoSource.js';
import { VideoThresholdPass } from './video/videoThresholdPass.js';
import { InitVectorSeedPass } from './jfa/initVectorSeed.js';
import { JumpFloodAlgorithm } from './jfa/jfaPass.js';
// import { VectorFieldDebug } from './jfa/jfaPass.js';
import { VelocityGrid } from './simulations/fluid/velocityGrid.js';
import { JfaToForcePass } from './simulations/fluid/jfaToFluid.js';
//import { VelocityDebugPass } from './simulations/fluid/velocityGrid.js';
import { ParticleSystem } from './simulations/particleSystem.js';
// import { ClearPass } from "./render/clearPass";
// import { FullscreenVideoPass } from './render/fullScreenVideoPass.js';

// Rendering pipeline:
// video -> videoThresholdPass (binaryTexture) -> fullScreenBinaryPass -> screen o/p.

const WIDTH = 480;
const HEIGHT = 360;
const NUM_PARTICLES = 10000;

// Initialise GPU Context in main.ts because all we use is video input.
async function main() {
    const gpu = GPUContext.getInstance();
    await gpu.init("canvas");

    // const clearPass = new ClearPass();
    let time = 0;

    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    const video = new VideoSource(
        gpu.device,
        WIDTH,
        HEIGHT,
        "badApple.mp4"
    );

    // Audio.
    const audio = new Audio("badAppleAudio.mp3");

    // Default audio settings.
    audio.loop = true;
    audio.volume = 0.5;

    const fluidParams = {
        dt: 0.016,
        forceScale: 1.0,
        pressureIterations: 20,
        dampening: 0.99,
        epsilon: 1.0, // Vorticity params.
    };

    const particleParams = {
        numParts: NUM_PARTICLES,
        advectionGain: 0.003
    };

    const gui = new GUI();
    const fluidFolder = gui.addFolder("Fluid Simulation");

    fluidFolder.add(fluidParams, "dt", 0.0, 5.0, 0.001);
    fluidFolder.add(fluidParams, "forceScale", 0.0, 100.0, 0.1);
    fluidFolder.add(fluidParams, "pressureIterations", 1, 100, 1);
    fluidFolder.add(fluidParams, "dampening", 0.0, 1.0, 0.001);

    fluidFolder.open();

    const particleFolder = gui.addFolder("Particle System");

    particleFolder.add(particleParams, "numParts", 1000, 50000, 1000)
        .onFinishChange((value: number) => {
            particleSystem.setParticleCount(
                gpu.device,
                value,
                velocityGrid.getVelocityTexture(),
                thresholdPass.binaryTexture
            );
        });
    particleFolder.add(particleParams, "advectionGain", 0.0, 10.0, 0.001);

    particleFolder.open();

    // TODO: Add smoke simulation params.
    const smokeFolder = gui.addFolder("Smoke Simulation");

    smokeFolder.add(fluidParams, "epsilon", 0.0, 50.0, 0.1);
    smokeFolder.open();

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
    // const canvas = document.getElementById("canvas") as HTMLCanvasElement;

    // Get the displayed size in pixels
    // const canvasWidth = canvas.width;
    // const canvasHeight = canvas.height;

    // Debug pass for vector field.
    // const vectorFieldDebugPass = new VectorFieldDebug(
    //     gpu.device,
    //     vectorTextureA,
    //     gpu.format,
    //     canvasWidth,
    //     canvasHeight
    // );

    // Convert JFA to force.
    const jfaToForce = new JfaToForcePass(gpu.device, WIDTH, HEIGHT, fluidParams.forceScale);

    // Velocity grid for fluid sim.
    const velocityGrid = new VelocityGrid(gpu.device, WIDTH, HEIGHT, fluidParams);
    //const velocityDebugPass = new VelocityDebugPass(gpu.device, gpu.format);

    // Particle system.
    const particleSystem = new ParticleSystem(
        gpu.device, NUM_PARTICLES, velocityGrid.getVelocityTexture(), thresholdPass.binaryTexture, gpu.format, fluidParams, particleParams.advectionGain
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
            jfaToForce.dispatch(gpu.device, finalTexture, WIDTH, HEIGHT);
            velocityGrid.step(gpu.device, dt, jfaToForce.forceTexture);
            //vectorFieldDebugPass.vectorTexture = finalTexture;
            particleSystem.step(gpu.device, velocityGrid.getVelocityTexture(), thresholdPass.binaryTexture);
            //jfaPass.dispatch(gpu.device, WIDTH, HEIGHT, vectorTextureA, vectorTextureB);
        },
        () => {
            const view = gpu.context.getCurrentTexture().createView();
            //vectorFieldDebugPass.render(gpu.device, gpu.context, canvasWidth, canvasHeight);
            //velocityDebugPass.render(gpu.device, gpu.context, velocityGrid.getVelocityTexture());
            particleSystem.render(gpu.device, view);
            // binaryDebugPass.render(gpu.device, gpu.context);
            // videoPass.render(gpu.device, gpu.context);
        }
    );

    // Sync audio to video.
    function syncAudioToVideo() {
        const drift = Math.abs(audio.currentTime - video.video.currentTime);

        if (drift > 0.05) { // 50 ms.
            audio.currentTime = video.video.currentTime;
        }

        requestAnimationFrame(syncAudioToVideo);
    }

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
        video.video.currentTime = 0;
        audio.currentTime = 0;

        await Promise.all([
            video.video.play(),
            audio.play()
        ]);
        syncAudioToVideo();
        frameLoop.start();
    }, { once: true });
}

main();
