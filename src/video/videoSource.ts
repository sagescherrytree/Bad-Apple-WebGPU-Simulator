// Import a video here and bake to GPU texture frames (?).

export class VideoSource {
    readonly video: HTMLVideoElement;
    readonly texture: GPUTexture;
    readonly sampler: GPUSampler;

    constructor(
        device: GPUDevice,
        width: number,
        height: number,
        src: string
    ) {
        this.video = document.createElement("video");
        this.video.src = src;
        this.video.muted = true;
        this.video.loop = true;
        this.video.autoplay = true;
        this.video.playsInline = true;
        this.video.crossOrigin = "anonymous";

        this.texture = device.createTexture({
            size: [width, height],
            format: "rgba8unorm",
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST
        });

        this.sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear"
        });
    }

    update(device: GPUDevice) {
        if (this.video.readyState < this.video.HAVE_CURRENT_DATA) return;

        device.queue.copyExternalImageToTexture(
            { source: this.video },
            { texture: this.texture },
            [this.texture.width, this.texture.height]
        );
    }
}
