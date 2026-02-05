export class FullscreenVideoPass {
    private pipeline: GPURenderPipeline;
    private bindGroup: GPUBindGroup;

    constructor(
        device: GPUDevice,
        format: GPUTextureFormat,
        videoTexture: GPUTexture,
        sampler: GPUSampler
    ) {
        // Create a basic pipeline to draw a fullscreen quad
        this.pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: device.createShaderModule({
                    code: `
            @vertex
            fn main(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
              var pos = array<vec2<f32>, 6>(
                vec2(-1.0, -1.0),
                vec2( 1.0, -1.0),
                vec2(-1.0,  1.0),
                vec2(-1.0,  1.0),
                vec2( 1.0, -1.0),
                vec2( 1.0,  1.0)
              );
              return vec4(pos[vertexIndex], 0.0, 1.0);
            }
          `
                }),
                entryPoint: "main"
            },
            fragment: {
                module: device.createShaderModule({
                    code: `
            @group(0) @binding(0) var videoTex : texture_2d<f32>;
            @group(0) @binding(1) var videoSampler : sampler;

            @fragment
            fn main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {
              let texSize = vec2<f32>(textureDimensions(videoTex));
              let uv = fragCoord.xy / texSize;
              return textureSample(videoTex, videoSampler, uv);
            }
          `
                }),
                entryPoint: "main",
                targets: [{ format }]
            },
            primitive: { topology: "triangle-list" }
        });

        this.bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: videoTexture.createView() },
                { binding: 1, resource: sampler }
            ]
        });
    }

    render(device: GPUDevice, context: GPUCanvasContext) {
        const encoder = device.createCommandEncoder();
        const view = context.getCurrentTexture().createView();

        const pass = encoder.beginRenderPass({
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
