import jfaToForceShader from "../../shaders/fluid/jfaToForce.cs.wgsl?raw";

export class JfaToForcePass {
    private pipeline: GPUComputePipeline;
    private uniformBuffer: GPUBuffer;
    readonly forceTexture: GPUTexture;

    forceScale: number = 1.0;

    constructor(device: GPUDevice, width: number, height: number, forceScale: number) {
        // Number read from parameter.
        this.forceScale = forceScale;

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

        this.uniformBuffer = device.createBuffer({
            size: 16, // For one float value (forceScale).
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    dispatch(device: GPUDevice, jfaTexture: GPUTexture, width: number, height: number) {
        const uniformData = new Float32Array(4);
        uniformData[0] = this.forceScale;

        device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            uniformData
        );

        const bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: jfaTexture.createView() },
                { binding: 1, resource: this.forceTexture.createView() },
                { binding: 2, resource: { buffer: this.uniformBuffer } },
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