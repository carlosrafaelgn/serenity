//
// MIT License
//
// Copyright (c) 2026 Carlos Rafael Gimenes das Neves
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// https://github.com/carlosrafaelgn/serenity
//

const noiseVertexShader = `#version 300 es
precision highp float;
in highp vec2 aPosition; // -1 (left/bottom) to 1 (right/top)
out highp vec2 vUV; // 0 (left/top) to 1 (right/bottom)

void main() {
gl_Position = vec4(aPosition.xy, 0, 1);
vUV = vec2((aPosition.x * 0.5) + 0.5, (aPosition.y * -0.5) + 0.5);
}
`;

// The code in noiseGeneratorFragmentShader was adapted from the tileable Perlin-Worley 3D noise
// available at https://www.shadertoy.com/view/3dVXDc, created by piyushslayer
const noiseGeneratorFragmentShader = `#version 300 es
precision highp float;
in highp vec2 vUV; // 0 (left/top) to 1 (right/bottom)
out highp vec4 outColor;
uniform highp float uZDivResolution;

// Hash by David_Hoskins
#define UI0 1597334673U
#define UI1 3812015801U
#define UI2 uvec2(UI0, UI1)
#define UI3 uvec3(UI0, UI1, 2798796415U)
#define UIF (1.0 / float(0xffffffffU))

vec3 hash33(vec3 p)
{
uvec3 q = uvec3(ivec3(p)) * UI3;
q = (q.x ^ q.y ^ q.z)*UI3;
return -1. + 2. * vec3(q) * UIF;
}

float remap(float x, float a, float b, float c, float d)
{
return (((x - a) / (b - a)) * (d - c)) + c;
}

// Gradient noise by iq (modified to be tileable)
float gradientNoise(vec3 x, float freq)
{
// grid
vec3 p = floor(x);
vec3 w = fract(x);

// quintic interpolant
vec3 u = w * w * w * (w * (w * 6. - 15.) + 10.);


// gradients
vec3 ga = hash33(mod(p + vec3(0., 0., 0.), freq));
vec3 gb = hash33(mod(p + vec3(1., 0., 0.), freq));
vec3 gc = hash33(mod(p + vec3(0., 1., 0.), freq));
vec3 gd = hash33(mod(p + vec3(1., 1., 0.), freq));
vec3 ge = hash33(mod(p + vec3(0., 0., 1.), freq));
vec3 gf = hash33(mod(p + vec3(1., 0., 1.), freq));
vec3 gg = hash33(mod(p + vec3(0., 1., 1.), freq));
vec3 gh = hash33(mod(p + vec3(1., 1., 1.), freq));

// projections
float va = dot(ga, w - vec3(0., 0., 0.));
float vb = dot(gb, w - vec3(1., 0., 0.));
float vc = dot(gc, w - vec3(0., 1., 0.));
float vd = dot(gd, w - vec3(1., 1., 0.));
float ve = dot(ge, w - vec3(0., 0., 1.));
float vf = dot(gf, w - vec3(1., 0., 1.));
float vg = dot(gg, w - vec3(0., 1., 1.));
float vh = dot(gh, w - vec3(1., 1., 1.));

// interpolation
return va + 
	u.x * (vb - va) + 
	u.y * (vc - va) + 
	u.z * (ve - va) + 
	u.x * u.y * (va - vb - vc + vd) + 
	u.y * u.z * (va - vc - ve + vg) + 
	u.z * u.x * (va - vb - ve + vf) + 
	u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);
}

// Tileable 3D worley noise
float worleyNoise(vec3 uv, float freq)
{    
vec3 id = floor(uv);
vec3 p = fract(uv);

float minDist = 10000.;
for (float x = -1.; x <= 1.; ++x)
{
for(float y = -1.; y <= 1.; ++y)
{
	for(float z = -1.; z <= 1.; ++z)
	{
		vec3 offset = vec3(x, y, z);
		vec3 h = hash33(mod(id + offset, vec3(freq))) * .5 + .5;
		h += offset;
		vec3 d = p - h;
		minDist = min(minDist, dot(d, d));
	}
}
}

// inverted worley noise
return 1. - minDist;
}

// Fbm for Perlin noise based on iq's blog
float perlinfbm(vec3 p, float freq, int octaves)
{
float G = exp2(-.85);
float amp = 1.;
float noise = 0.;
for (int i = 0; i < octaves; ++i)
{
noise += amp * gradientNoise(p * freq, freq);
freq *= 2.;
amp *= G;
}

return noise;
}

// Tileable Worley fbm inspired by Andrew Schneider's Real-Time Volumetric Cloudscapes
// chapter in GPU Pro 7.
float worleyFbm(vec3 p, float freq)
{
return worleyNoise(p*freq, freq) * .625 +
		worleyNoise(p*freq*2., freq*2.) * .25 +
		worleyNoise(p*freq*4., freq*4.) * .125;
}

void main()
{
vec4 col = vec4(0.);

float freq = 4.;

float pfbm= mix(1., perlinfbm(vec3(vUV, uZDivResolution), 4., 7), .5);
pfbm = abs(pfbm * 2. - 1.); // billowy perlin noise

col.g += worleyFbm(vec3(vUV, uZDivResolution), freq);
col.b += worleyFbm(vec3(vUV, uZDivResolution), freq*2.);
col.a += worleyFbm(vec3(vUV, uZDivResolution), freq*4.);
col.r += remap(pfbm, 0., 1., col.g, 1.); // perlin-worley

outColor = vec4(col);
}
`;

const mainVertexShader = `#version 300 es
precision highp float;
in highp vec2 aPosition; // -1 (left/bottom) to 1 (right/top)
out highp vec2 vUV; // 0 (left/top) to 1 (right/bottom)
// vSkyPlaneUV.x does not follow the -1/1 range, because if they did, the
// clouds would be naturally repeated twice, since the coordinates in the noise
// texture are in the range between 0/1.
// vSkyPlaneUV.y does not follow the -1/1 range, because the image used as the
// scene background is shifted a little bit upwards, and the horizon is below
// the middle of the screen (the upper half is 598 pixels tall, whereas the
// lower half is 482 pixels tall -> 482/598 = 0.806020067).
// This difference is important because the virtual z coordinate is generated
// based on this value, and we do not want all clouds that appear at the top
// being reflected at the bottom.
out highp vec2 vSkyPlaneUV; // -0.5 (left) to 0.5 (right) / -0.806020067 (bottom) to 1 (top)

void main() {
gl_Position = vec4(aPosition.xy, 0, 1);
float x05 = aPosition.x * 0.5;
vUV = vec2(x05 + 0.5, (aPosition.y * -0.5) + 0.5);
vSkyPlaneUV = vec2(x05, clamp(aPosition.y, -0.806020067, 1.0));
}
`;

const mainFragmentShader = `#version 300 es
precision highp float;
in highp vec2 vUV; // 0 (left/top) to 1 (right/bottom)
in highp vec2 vSkyPlaneUV; // -0.5 (left) to 0.5 (right) / -0.806020067 (bottom) to 1 (top)
out highp vec4 outColor;
uniform highp float uTime;
uniform highp vec2 uOffset;
uniform highp sampler2D sBackground;
uniform highp sampler3D sCloudNoise;

float remap(float x, float a, float b, float c, float d) {
	return (((x - a) / (b - a)) * (d - c)) + c;
}

void main() {
	float absSkyY = abs(vSkyPlaneUV.y);
	float skyPlaneX = vSkyPlaneUV.x;
	vec2 backgroundUV = vUV;
	float rippleLight = 1.0;

	if (vSkyPlaneUV.y < 0.0) {
		// Add sea ripples on the sea by displacing the coordinates used to sample both
		// the background and the reflected clouds, before any sampling actually takes place.
		// seaDepth is 0 at the horizon and 1 at the bottom of the screen, in order to make
		// the ripples more subtle at the horizon and stronger at the bottom of the screen.
		float seaDepth = absSkyY / 0.806020067;
		// Overall ripple strength (1.0 = very gentle)
		float rippleAmplitude = 2.75;
		float rippleStrength = seaDepth * seaDepth * rippleAmplitude;
		// Perspective-like coordinates to make wave crests get closer together near
		// the horizon and farther apart near the camera (the + 0.3 keeps the
		// frequency bounded near the horizon, avoiding aliasing).
		float waveZ = 1.0 / (seaDepth + 0.3);
		// uTime goes from 0 to 1 and then wraps around, so every time factor
		// must be an integer multiple of 2pi for the animation to loop
		// seamlessly. Adding time moves the crests towards the camera.
		float t = uTime * 6.283185307;
		float w1 = waveZ * 14.0 + skyPlaneX * 3.0 + t * 50.0;
		float w2 = waveZ * 23.0 - skyPlaneX * 5.0 + t * 71.0;
		float w3 = waveZ * 37.0 + skyPlaneX * 9.0 + t * 97.0;
		// Mostly horizontal wobble (it breaks up the reflections the way real
		// water does), plus a smaller vertical one.
		float rippleX = rippleStrength * (0.010 * sin(w1) + 0.005 * sin(w2) + 0.0025 * sin(w3));
		float rippleY = rippleStrength * (0.006 * cos(w1) + 0.003 * cos(w2));
		skyPlaneX += rippleX;
		absSkyY += rippleY;
		// vUV.x = vSkyPlaneUV.x + 0.5, and vUV.y goes from 0 (top, sky plane y = 1)
		// to 1 (bottom, sky plane y = -0.806020067), growing downwards, so moving
		// absSkyY down by rippleY moves vUV.y by rippleY / 1.806020067.
		// MIRRORED_REPEAT keeps samples slightly outside the edges inside the sea.
		backgroundUV += vec2(rippleX, rippleY / 1.806020067);
		// Very subtle light/shadow on the crests, so the ripples are also
		// visible where there are no reflected clouds (set to 0.0 to disable)
		rippleLight = 1.0 + (rippleStrength * 0.05 * (sin(w1) + 0.5 * sin(w2)));
	}

	vec4 backgroundColor = texture(sBackground, backgroundUV);
	backgroundColor.rgb *= rippleLight;

	// Place the upper horizon at 0.25, intead of 0.0, to make the clouds in the sky
	// appear higher (so, there are no clouds between 0.0 and 0.25)
	if (vSkyPlaneUV.y < 0.0 || vSkyPlaneUV.y > 0.25) {
		if (vSkyPlaneUV.y >= 0.0) {
			absSkyY = remap(absSkyY, 0.25, 1.0, 0.0, 1.0);
		}

		// Try to simulate the field of view of a camera, making x coordinates near the
		// camera use their actual range, but making their range wider when far from
		// the camera.
		float skyX = skyPlaneX / remap(absSkyY, 0.0, 1.0, 0.5, 1.0);
		float skyZ = 1.0 - absSkyY; // 0 near the camera and 1 far from the camera

		// Repeat the clouds more vertically than horizontally
		vec2 cloudUV = vec2(skyX * 2.0, skyZ * 3.0);

		// ------------------------------------------------------------------
		// Sample the first frequency apart from the rest, to use different
		// coordinates only with the first frequency, in order to increase
		// the overall size of the clouds
		float perlinWorley = texture(sCloudNoise, vec3((cloudUV - uOffset) * 0.25, uTime)).x; // (cloudUV - uOffset) * 0.5 to make clouds somewhat smaller
		// Extracted from https://www.shadertoy.com/view/3dVXDc
		vec3 worley = texture(sCloudNoise, vec3(cloudUV - uOffset, uTime)).yzw;
		float wfbm = worley.x * 0.625 + worley.y * 0.125 + worley.z * 0.25; 
		// Cloud shape modeled after the GPU Pro 7 chapter
		float cloud = remap(perlinWorley, wfbm - 1.0, 1.0, 0.0, 1.0);
		cloud = clamp(remap(cloud, 0.8, 1.0, 0.0, 1.0), 0.0, 1.0);
		// ------------------------------------------------------------------

		vec4 cloudRGBA;
		if (vSkyPlaneUV.y < 0.0) {
			// Reflected clouds are white
			cloudRGBA = vec4(cloud, cloud, cloud, 0.0);
		} else {
			// Clouds in the sky are somewhat orange/yellow
			cloudRGBA = vec4(0.99 * cloud, 0.82 * cloud, 0.62 * cloud, 0.0);
		}

		float hazeFactor = absSkyY * absSkyY;

		// Make the reflection of the cloud (y < 0.0) more transparent than
		// the cloud itself
		float cloudOpacity = (vSkyPlaneUV.y < 0.0 ? 0.25 : 0.5);

		outColor = backgroundColor + (cloudRGBA * hazeFactor * cloudOpacity);
	} else {
		// This is the empty area between the end of the upper clouds and
		// the start of the water/reflex
		outColor = backgroundColor;
	}
}
`;
