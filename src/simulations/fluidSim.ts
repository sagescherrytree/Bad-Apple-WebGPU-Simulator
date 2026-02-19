import fluidSimShader from '../shaders/fluidSim.cs.wgsl?raw';

export class FluidSim {
    fluidPipeline: GPUComputePipeline;
    fluidBindGroupLayout: GPUBindGroupLayout;
    fluidBindGroup: GPUBindGroup;

    // Pass in vector texture from JFA.
    constructor(device: GPUDevice, vectorTexture: GPUTexture) {
        this.fluidPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: device.createShaderModule({ code: fluidSimShader }),
                entryPoint: "main",
            }
        });
    }
}