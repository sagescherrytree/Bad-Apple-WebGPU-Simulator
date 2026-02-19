// Initialise in vectors for JFA.
// Call a compute shader to set each pixel to find its opposite colour.
import initVectorShader from "../shaders/initVecSeedCompute.cs.wgsl?raw";

export class InitVectorSeedPass {
    vecPassPipeline: GPUComputePipeline;
    vecPassBindGroup: GPUBindGroup;

    constructor(device: GPUDevice, binaryTexture: GPUTexture, vectorTexture: GPUTexture) {

        this.vecPassPipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: device.createShaderModule({ code: initVectorShader }),
                entryPoint: "main",
            }
        });

        this.vecPassBindGroup = device.createBindGroup({
            layout: this.vecPassPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: binaryTexture.createView() },
                { binding: 1, resource: vectorTexture.createView() }
            ]
        });
    }

    dispatch(device: GPUDevice, width: number, height: number) {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();

        pass.setPipeline(this.vecPassPipeline);
        pass.setBindGroup(0, this.vecPassBindGroup);
        pass.dispatchWorkgroups(
            Math.ceil(width / 8),
            Math.ceil(height / 8)
        );

        pass.end();
        device.queue.submit([encoder.finish()]);
    }
}