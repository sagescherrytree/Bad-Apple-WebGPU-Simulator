@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {

    let center = vec2<f32>(0.5, 0.5);
    let d = distance(uv, center);

    let alpha = exp(-d * d * 12.0);

    let smokeColor = vec3<f32>(1.0, 1.0, 1.0);

    return vec4<f32>(smokeColor, alpha * 0.2);
}