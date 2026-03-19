import jfaToForceShader from "../../shaders/fluid/jfaToForce.cs.wgsl?raw";

export class JfaToForcePass {
    private pipeline: GPUComputePipeline;
    readonly forceTexture: GPUTexture;

    constructor(device: GPUDevice, width: number, height: number) {
        this.forceTexture = device.createTexture({
            size: [width, height],
            format: "rgba32float",
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING,
        });

        this.pipeline = device.createComputePipeline({
            layout: "auto",
            compute: {
                module: device.createShaderModule({ code: jfaToForceShader }),
                entryPoint: "main",
            },
        });
    }

    dispatch(device: GPUDevice, jfaTexture: GPUTexture, width: number, height: number) {
        const bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: jfaTexture.createView() },
                { binding: 1, resource: this.forceTexture.createView() },
            ],
        });

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
        pass.end();
        device.queue.submit([encoder.finish()]);
    }
}