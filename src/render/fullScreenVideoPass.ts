// Class to create a rectangle full screen to render each frame of the video onto.

export class FullscreenVideoPass {
    private pipeline: GPURenderPipeline;
    private bindGroup: GPUBindGroup;

    constructor(
        device: GPUDevice,
        format: GPUTextureFormat,
        videoTexture: GPUTexture,
        sampler: GPUSampler
    ) {
        const vertexModule = device.createShaderModule({
            label: "FullscreenVideoVertexShader",
            code: `
                struct VSOut {
                @builtin(position) position : vec4<f32>,
                @location(0) uv : vec2<f32>,
            };

            @vertex
            fn main(@builtin(vertex_index) i : u32) -> VSOut {
                var positions = array<vec2<f32>, 6>(
                    vec2(-1.0, -1.0),
                    vec2( 1.0, -1.0),
                    vec2(-1.0,  1.0),
                    vec2(-1.0,  1.0),
                    vec2( 1.0, -1.0),
                    vec2( 1.0,  1.0)
                );

                var uvs = array<vec2<f32>, 6>(
                    vec2(0.0, 1.0),
                    vec2(1.0, 1.0),
                    vec2(0.0, 0.0),
                    vec2(0.0, 0.0),
                    vec2(1.0, 1.0),
                    vec2(1.0, 0.0)
                );

                var out : VSOut;
                out.position = vec4(positions[i], 0.0, 1.0);
                out.uv = uvs[i];
                return out;
            }`
        });

        const fragmentModule = device.createShaderModule({
            label: "FullscreenVideoFragmentShader",
            code: `
                @group(0) @binding(0) var videoTex : texture_2d<f32>;
                @group(0) @binding(1) var videoSampler : sampler;

                @fragment
                fn main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
                    return textureSample(videoTex, videoSampler, uv);
                }`
        });

        // Minimalistic rendering pipeline.
        this.pipeline = device.createRenderPipeline({
            label: "FullscreenVideoPipeline",
            layout: "auto",
            vertex: {
                module: vertexModule,
                entryPoint: "main"
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format }]
            },
            primitive: {
                topology: "triangle-list"
            }
        });

        // Bind group.
        this.bindGroup = device.createBindGroup({
            label: "FullscreenVideoBindGroup",
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: videoTexture.createView({
                        label: "FullscreenVideoTextureView"
                    })
                },
                {
                    binding: 1,
                    resource: sampler
                }
            ]
        });
    }

    render(device: GPUDevice, context: GPUCanvasContext) {
        const encoder = device.createCommandEncoder({
            label: "FullscreenVideoCommandEncoder"
        });

        const view = context.getCurrentTexture().createView({
            label: "FullscreenVideoSwapchainView"
        });

        const pass = encoder.beginRenderPass({
            label: "FullscreenVideoRenderPass",
            colorAttachments: [{
                view,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(6);
        pass.end();

        device.queue.submit([encoder.finish()]);
    }
}
