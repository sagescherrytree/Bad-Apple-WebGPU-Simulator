import trailBlitVertShader from "../shaders/trailBlit.vert.wgsl?raw";;
import trailBlitFragShader from "../shaders/trailBlit.frag.wgsl?raw";;

export interface TrailParams {
    fadeAmount: number;
    intensity: number;
}

export class TrailPass {
    private readonly trailTextures: GPUTexture[];
    private readonly trailTextureViews: GPUTextureView[];
    private activeTextureIndex = 0;

    private width: number;
    private height: number;

    // Fade pass — dims the trail texture each frame.
    private fadePipeline: GPUComputePipeline;
    private fadeUniformBuffer: GPUBuffer;

    // Blit pass — fullscreen quad that draws trail texture.
    private blitPipeline: GPURenderPipeline;
    private blitUniformBuffer: GPUBuffer;
    private blitSampler: GPUSampler;

    trailParams: TrailParams;

    constructor(
        device: GPUDevice,
        format: GPUTextureFormat,
        width: number,
        height: number,
        params?: TrailParams
    ) {
        this.width = width;
        this.height = height;

        this.trailParams = params ?? {
            fadeAmount: 0.95,
            intensity: 1.0,
        };

        // Trail textures. Fade is ping-ponged so rgba8unorm only needs write-only
        // storage access, which is supported broadly by WebGPU implementations.
        this.trailTextures = [0, 1].map((i) => device.createTexture({
            label: `TrailTexture${i}`,
            size: [width, height],
            format: "rgba8unorm",
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.STORAGE_BINDING,
        }));

        this.trailTextureViews = this.trailTextures.map((texture, i) =>
            texture.createView({ label: `TrailTextureView${i}` })
        );

        this.fadeUniformBuffer = device.createBuffer({
            label: "TrailFadeUniform",
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.fadePipeline = device.createComputePipeline({
            label: "TrailFadePipeline",
            layout: "auto",
            compute: {
                module: device.createShaderModule({
                    label: "TrailFadeShader",
                    code: trailBlitVertShader
                }),
                entryPoint: "main",
            },
        });

        // Blit pass.
        this.blitUniformBuffer = device.createBuffer({
            label: "TrailBlitUniform",
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.blitSampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });

        this.blitPipeline = device.createRenderPipeline({
            label: "TrailBlitPipeline",
            layout: "auto",
            vertex: {
                module: device.createShaderModule({
                    label: "TrailBlitVertexShader",
                    code: /* wgsl */`
                        struct VSOut {
                            @builtin(position) pos : vec4<f32>,
                            @location(0) uv : vec2<f32>,
                        };
 
                        @vertex
                        fn main(@builtin(vertex_index) i : u32) -> VSOut {
                            // Fullscreen triangle — covers NDC [-1,1] with a single triangle.
                            var positions = array<vec2<f32>, 3>(
                                vec2<f32>(-1.0, -1.0),
                                vec2<f32>( 3.0, -1.0),
                                vec2<f32>(-1.0,  3.0)
                            );
                            var uvs = array<vec2<f32>, 3>(
                                vec2<f32>(0.0, 1.0),
                                vec2<f32>(2.0, 1.0),
                                vec2<f32>(0.0, -1.0)
                            );
 
                            var out: VSOut;
                            out.pos = vec4<f32>(positions[i], 0.0, 1.0);
                            out.uv  = uvs[i];
                            return out;
                        }
                    `,
                }),
                entryPoint: "main",
            },
            fragment: {
                module: device.createShaderModule({
                    label: "TrailBlitFragmentShader",
                    code: trailBlitFragShader
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
                            dstFactor: "one",
                            operation: "add",
                        },
                    },
                }],
            },
            primitive: { topology: "triangle-list" },
        });

    }

    get trailTexture(): GPUTexture {
        return this.trailTextures[this.activeTextureIndex];
    }

    get trailTextureView(): GPUTextureView {
        return this.trailTextureViews[this.activeTextureIndex];
    }

    fade(device: GPUDevice) {
        const data = new Float32Array(4);
        data[0] = this.trailParams.fadeAmount;
        device.queue.writeBuffer(this.fadeUniformBuffer, 0, data);

        const sourceIndex = this.activeTextureIndex;
        const destinationIndex = 1 - sourceIndex;

        const fadeBindGroup = device.createBindGroup({
            layout: this.fadePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.trailTextureViews[sourceIndex] },
                { binding: 1, resource: this.trailTextureViews[destinationIndex] },
                { binding: 2, resource: { buffer: this.fadeUniformBuffer } },
            ],
        });

        const encoder = device.createCommandEncoder({ label: "TrailFadeEncoder" });
        const pass = encoder.beginComputePass({ label: "TrailFadePass" });

        pass.setPipeline(this.fadePipeline);
        pass.setBindGroup(0, fadeBindGroup);
        pass.dispatchWorkgroups(
            Math.ceil(this.width / 8),
            Math.ceil(this.height / 8)
        );

        pass.end();
        device.queue.submit([encoder.finish()]);

        this.activeTextureIndex = destinationIndex;
    }

    blit(device: GPUDevice, context: GPUCanvasContext) {
        const data = new Float32Array(4);
        data[0] = this.trailParams.intensity;
        device.queue.writeBuffer(this.blitUniformBuffer, 0, data);

        const blitBindGroup = device.createBindGroup({
            label: "TrailBlitBindGroup",
            layout: this.blitPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.trailTextureView },
                { binding: 1, resource: this.blitSampler },
                { binding: 2, resource: { buffer: this.blitUniformBuffer } },
            ],
        });

        const encoder = device.createCommandEncoder({ label: "TrailBlitEncoder" });

        const pass = encoder.beginRenderPass({
            label: "TrailBlitPass",
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }],
        });

        pass.setPipeline(this.blitPipeline);
        pass.setBindGroup(0, blitBindGroup);
        pass.draw(3); // Fullscreen triangle
        pass.end();

        device.queue.submit([encoder.finish()]);
    }
}
