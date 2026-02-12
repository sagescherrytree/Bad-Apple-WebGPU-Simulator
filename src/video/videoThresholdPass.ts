// Turn each frame of video read from videoSource into binary texture to be read in Jump Flood Algorithm.

export class VideoThresholdPass {
    private computePassPipeline: GPUComputePipeline;
    private computePassBindgroup: GPUBindGroup;

    readonly binaryTexture: GPUTexture; // Output GPU Texture.

    private width: number;
    private height: number;

    constructor(
        device: GPUDevice,
        videoTexture: GPUTexture,
        sampler: GPUSampler,
        width: number,
        height: number
    ) {
        this.width = Math.floor(width);
        this.height = Math.floor(height);

        this.binaryTexture = device.createTexture({
            label: "BinaryMaskTexture",
            size: [this.width, this.height],
            format: "rgba8unorm",
            usage:
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.TEXTURE_BINDING
        });

        const computeShader = device.createShaderModule({
            label: "ComputeVideoToBinaryPass",
            code: `
                @group(0) @binding(0) var videoTex : texture_2d<f32>;
                @group(0) @binding(1) var videoSampler : sampler;
                @group(0) @binding(2) var binaryOut :
                    texture_storage_2d<rgba8unorm, write>;

                @compute @workgroup_size(8, 8)
                fn main(@builtin(global_invocation_id) id : vec3<u32>) {
                    let dims = textureDimensions(binaryOut);
                    if (id.x >= dims.x || id.y >= dims.y) {
                        return;
                    }

                    let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(dims);
                    let color = textureSampleLevel(videoTex, videoSampler, uv, 0.0).rgb;

                    let luma = dot(color, vec3<f32>(0.299, 0.587, 0.114));
                    let v = select(0.0, 1.0, luma > 0.5);

                    textureStore(binaryOut, vec2<i32>(id.xy), vec4<f32>(v * 0.85, v * 0.75, v, 0.0));
                }
            `
        });

        this.computePassPipeline = device.createComputePipeline({
            label: "FullscreenVideoPipeline",
            layout: "auto",
            compute: {
                module: computeShader, entryPoint: "main"
            }
        });

        this.computePassBindgroup = device.createBindGroup({
            label: "VideoThresholdBindGroup",
            layout: this.computePassPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: videoTexture.createView()
                },
                {
                    binding: 1,
                    resource: sampler
                },
                {
                    binding: 2,
                    resource: this.binaryTexture.createView()
                }
            ]
        });
    }
    dispatch(device: GPUDevice) {
        const encoder = device.createCommandEncoder({
            label: "VideoThresholdEncoder"
        });

        const pass = encoder.beginComputePass({
            label: "VideoThresholdPass"
        });

        pass.setPipeline(this.computePassPipeline);
        pass.setBindGroup(0, this.computePassBindgroup);

        pass.dispatchWorkgroups(
            Math.ceil(this.width / 8),
            Math.ceil(this.height / 8)
        );

        pass.end();
        device.queue.submit([encoder.finish()]);
    }
}
