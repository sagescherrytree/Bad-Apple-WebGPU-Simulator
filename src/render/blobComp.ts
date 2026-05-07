import fullscreenVertShader from "../shaders/trailBlit.vert.wgsl?raw";
import blobFragShader from "../shaders/blobs/blobs.frag.wgsl?raw";

export interface BlobCompositeParams {
    threshold: number;
    softness: number;
    intensity: number;
}

export class BlobCompositePass {
    private pipeline: GPURenderPipeline;
    private bindGroup: GPUBindGroup;
    private paramsBuffer: GPUBuffer;

    constructor(
        device: GPUDevice,
        format: GPUTextureFormat,
        densityTextureView: GPUTextureView,
    ) {
        this.pipeline = device.createRenderPipeline({
            label: "BlobCompositePipeline",
            layout: "auto",
            vertex: {
                module: device.createShaderModule({
                    label: "BlobCompositeVertexShader",
                    code: fullscreenVertShader,
                }),
                entryPoint: "main",
            },
            fragment: {
                module: device.createShaderModule({
                    label: "BlobCompositeFragmentShader",
                    code: blobFragShader,
                }),
                entryPoint: "main",
                targets: [{
                    format,
                    blend: {
                        color: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                        alpha: {
                            srcFactor: "one",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                    },
                }],
            },
            primitive: { topology: "triangle-list" },
        });

        this.paramsBuffer = device.createBuffer({
            label: "BlobCompositeParamsBuffer",
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = device.createBindGroup({
            label: "BlobCompositeBindGroup",
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: densityTextureView },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
            ],
        });
    }

    render(
        device: GPUDevice,
        view: GPUTextureView,
        colour: [number, number, number],
        params: BlobCompositeParams,
    ) {
        const data = new Float32Array(8);
        data[0] = colour[0] / 255.0;
        data[1] = colour[1] / 255.0;
        data[2] = colour[2] / 255.0;
        data[3] = 1.0;
        data[4] = params.threshold;
        data[5] = params.softness;
        data[6] = params.intensity;
        device.queue.writeBuffer(this.paramsBuffer, 0, data);

        const encoder = device.createCommandEncoder({ label: "BlobCompositeEncoder" });
        const pass = encoder.beginRenderPass({
            label: "BlobCompositePass",
            colorAttachments: [{
                view,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }],
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3);
        pass.end();

        device.queue.submit([encoder.finish()]);
    }
}
