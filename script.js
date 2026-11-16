"use strict";
const isIOSOrSafari = (function () {
	if ((navigator.userAgent.indexOf("Chrome") <= 0 && navigator.userAgent.indexOf("Safari") >= 0) ||
		(navigator.userAgent.indexOf("Mac") >= 0 && ("ontouchend" in document)))
		return true;
	switch (navigator.platform) {
		case "iPad Simulator":
		case "iPhone Simulator":
		case "iPod Simulator":
		case "iPad":
		case "iPhone":
		case "iPod":
			return true;
	}
	return false;
})(), baseWidth = 1280, baseHeight = 720, noiseResolution = 128;
function ignorePromise(p) {
	try {
		const nop = function () { };
		if (p && p.then)
			p.then(nop, nop);
	}
	catch (ex) {
	}
}
function cancelEvent(e) {
	if (e) {
		if ("isCancelled" in e)
			e.isCancelled = true;
		if (("preventDefault" in e) && (!("cancelable" in e) || e.cancelable))
			e.preventDefault();
		if ("stopPropagation" in e)
			e.stopPropagation();
	}
	return false;
}
class FullscreenControl {
	static requestFullscreen(element) {
		if (!element)
			element = document.body;
		let ok = true, p = null;
		try {
			if (element["requestFullscreen"])
				p = element["requestFullscreen"]();
			else if (element["webkitRequestFullscreen"])
				p = element["webkitRequestFullscreen"]();
			else if (element["mozRequestFullScreen"])
				p = element["mozRequestFullScreen"]();
			else if (element["msRequestFullscreen"])
				p = element["msRequestFullscreen"]();
			else
				ok = false;
		}
		catch (ex) {
			ok = false;
		}
		if (!ok && element !== document.body)
			FullscreenControl.requestFullscreen();
		else
			ignorePromise(p);
	}
	static exitFullscreen() {
		let p = null;
		try {
			if (document["exitFullscreen"])
				p = document["exitFullscreen"]();
			else if (document["webkitExitFullscreen"])
				p = document["webkitExitFullscreen"]();
			else if (document["mozExitFullScreen"])
				p = document["mozExitFullScreen"]();
			else if (document["msExitFullscreen"])
				p = document["msExitFullscreen"]();
		}
		catch (ex) {
		}
		ignorePromise(p);
	}
	static get fullscreenElement() {
		let e = null;
		try {
			if (("fullscreenElement" in document))
				e = document["fullscreenElement"];
			if (!e && ("webkitFullscreenElement" in document))
				e = document["webkitFullscreenElement"];
			if (!e && ("mozFullscreenElement" in document))
				e = document["mozFullscreenElement"];
			if (!e && ("msFullscreenElement" in document))
				e = document["msFullscreenElement"];
		}
		catch (ex) {
		}
		return e;
	}
	get onfullscreenchange() {
		try {
			if (("onfullscreenchange" in document))
				return document["onfullscreenchange"];
			if (("onwebkitfullscreenchange" in document))
				return document["onwebkitfullscreenchange"];
			if (("onmozfullscreenchange" in document))
				return document["onmozfullscreenchange"];
			if (("onmsfullscreenchange" in document))
				return document["onmsfullscreenchange"];
		}
		catch (ex) {
		}
		return null;
	}
	static set onfullscreenchange(listener) {
		try {
			if (("onfullscreenchange" in document))
				document["onfullscreenchange"] = listener;
			if (("onwebkitfullscreenchange" in document))
				document["onwebkitfullscreenchange"] = listener;
			if (("onmozfullscreenchange" in document))
				document["onmozfullscreenchange"] = listener;
			if (("onmsfullscreenchange" in document))
				document["onmsfullscreenchange"] = listener;
		}
		catch (ex) {
		}
	}
	static toggleFullscreen() {
		FullscreenControl.fullscreenMode = !FullscreenControl.fullscreenMode;
	}
	static get fullscreenMode() {
		return !!FullscreenControl.fullscreenElement;
	}
	static set fullscreenMode(fullscreen) {
		if (fullscreen)
			FullscreenControl.requestFullscreen();
		else
			FullscreenControl.exitFullscreen();
	}
}
const noiseVertexShader = `#version 300 es
precision highp float;
in highp vec2 aPosition; // -1 (left/bottom) to 1 (right/top)
out highp vec2 vUV; // 0 (left/top) to 1 (right/bottom)

void main() {
gl_Position = vec4(aPosition.xy, 0, 1);
vUV = vec2((aPosition.x * 0.5) + 0.5, (aPosition.y * -0.5) + 0.5);
}
`;
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
const generatedNoiseBlobs = null;
const canvas = document.createElement("canvas");
canvas.className = "fade";
canvas.width = baseWidth;
canvas.height = baseHeight;
document.body.appendChild(canvas);
const gl = canvas.getContext("webgl2", {
	alpha: false,
	depth: false,
	stencil: false,
	antialias: false,
	premultipliedAlpha: true
});
const programInfo = {
	program: null,
	attribLocations: {
		aPosition: 0,
	},
	uniformLocations: {
		uTime: null,
		uOffset: null,
		sBackground: null,
		sCloudNoise: null,
	},
};
async function setupWebGL() {
	if (!gl) {
		alert("WebGL 2 not supported");
		return false;
	}
	let backgroundResolve = null;
	let backgroundReject = null;
	const backgroundPromise = new Promise(function (resolve, reject) {
		backgroundResolve = resolve;
		backgroundReject = reject;
	});
	const backgroundImage = new Image();
	backgroundImage.onload = backgroundResolve;
	backgroundImage.onerror = function (event, source, lineno, colno, error) {
		if (backgroundReject)
			backgroundReject(error || "Unknown error");
	};
	backgroundImage.src = "bg.png";
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);
	gl.disable(gl.DITHER);
	gl.disable(gl.SCISSOR_TEST);
	gl.disable(gl.POLYGON_OFFSET_FILL);
	gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
	gl.disable(gl.SAMPLE_COVERAGE);
	gl.disable(gl.STENCIL_TEST);
	gl.disable(gl.BLEND);
	function loadShader(type, source) {
		const shader = gl.createShader(type);
		if (!shader) {
			alert(`An unknown error occurred while compiling the shader type ${type}`);
			gl.deleteShader(shader);
			return null;
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			alert(`An error occurred while compiling the shader type ${type}: ${gl.getShaderInfoLog(shader)}`);
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}
	function initProgram(vertexShaderSource, fragmentShaderSource) {
		const vertexShader = loadShader(gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
		if (!vertexShader || !fragmentShader)
			return null;
		const shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			alert(`An error occurred while initializing the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
			return null;
		}
		return shaderProgram;
	}
	const positions = new Float32Array([
		-1, 1,
		-1, -1,
		1, 1,
		1, 1,
		-1, -1,
		1, -1,
	]);
	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	const noiseTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_3D, noiseTexture);
	gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, noiseResolution, noiseResolution, noiseResolution);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	if (generatedNoiseBlobs) {
		const noiseGeneratorProgram = initProgram(noiseVertexShader, noiseGeneratorFragmentShader);
		if (!noiseGeneratorProgram) {
			alert("An error occurred while initializing the noise generator program");
			return false;
		}
		const noiseFBO = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, noiseFBO);
		gl.viewport(0, 0, noiseResolution, noiseResolution);
		gl.useProgram(noiseGeneratorProgram);
		const aPosition = gl.getAttribLocation(noiseGeneratorProgram, "aPosition");
		const uZDivResolution = gl.getUniformLocation(noiseGeneratorProgram, "uZDivResolution");
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.enableVertexAttribArray(aPosition);
		gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
		const pixels = new Uint8Array(noiseResolution * noiseResolution * 4);
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = noiseResolution;
		tempCanvas.height = noiseResolution;
		const tempCtx = tempCanvas.getContext("2d", { alpha: false });
		const imageData = tempCtx.createImageData(noiseResolution, noiseResolution);
		for (let z = 0; z < noiseResolution; z++) {
			gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, noiseTexture, 0, z);
			gl.uniform1f(uZDivResolution, z / noiseResolution);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			gl.flush();
			gl.readPixels(0, 0, noiseResolution, noiseResolution, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			imageData.data.set(pixels);
			tempCtx.putImageData(imageData, 0, 0);
			const blob = await new Promise(function (resolve) {
				tempCanvas.toBlob(resolve, "image/png");
			});
			if (blob) {
				generatedNoiseBlobs.push(blob);
				console.log(`PNG ${z} generated`);
			}
			else {
				console.error(`Error generating PNG ${z}`);
				return false;
			}
		}
		gl.useProgram(null);
		gl.deleteProgram(noiseGeneratorProgram);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(noiseFBO);
		return false;
	}
	else {
		const div = document.createElement("div");
		div.className = "alert";
		div.textContent = "Loading data...";
		document.body.appendChild(div);
		const noiseImages = new Array(noiseResolution);
		function loadNoiseImage(i) {
			return new Promise(function (resolve, reject) {
				const image = new Image();
				image.onload = function () {
					noiseImages[i] = image;
					resolve();
				};
				image.onerror = function (event, source, lineno, colno, error) {
					reject(error || "Unknown error");
				};
				image.src = `pre-rendered-noise/noise-${(i < 10 ? "00" : (i < 100 ? "0" : ""))}${i}.png`;
			});
		}
		for (let i = 0; i < noiseResolution; i += 8) {
			const noisePromises = new Array(8);
			for (let j = 0; j < 8; j++)
				noisePromises[j] = loadNoiseImage(i + j);
			try {
				await Promise.all(noisePromises);
			}
			catch (ex) {
				alert(`Error loading noise images: ${(ex.message || ex.toString())}`);
				return false;
			}
		}
		for (let i = 0; i < noiseResolution; i++) {
			gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, i, noiseResolution, noiseResolution, 1, gl.RGBA, gl.UNSIGNED_BYTE, noiseImages[i]);
			noiseImages[i] = null;
		}
		document.body.removeChild(div);
	}
	gl.viewport(0, 0, canvas.width, canvas.height);
	const mainProgram = initProgram(mainVertexShader, mainFragmentShader);
	if (!mainProgram) {
		alert("An error occurred while initializing the main program");
		return false;
	}
	gl.useProgram(mainProgram);
	programInfo.program = mainProgram;
	programInfo.attribLocations.aPosition = gl.getAttribLocation(mainProgram, "aPosition");
	programInfo.uniformLocations.uTime = gl.getUniformLocation(mainProgram, "uTime");
	programInfo.uniformLocations.uOffset = gl.getUniformLocation(mainProgram, "uOffset");
	programInfo.uniformLocations.sBackground = gl.getUniformLocation(mainProgram, "sBackground");
	programInfo.uniformLocations.sCloudNoise = gl.getUniformLocation(mainProgram, "sCloudNoise");
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.enableVertexAttribArray(programInfo.attribLocations.aPosition);
	gl.vertexAttribPointer(programInfo.attribLocations.aPosition, 2, gl.FLOAT, false, 0, 0);
	try {
		await backgroundPromise;
	}
	catch (ex) {
		alert(`An error occurred while loading the background image: ${(ex.message || ex.toString())}`);
		return false;
	}
	gl.activeTexture(gl.TEXTURE0);
	const backgroundTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backgroundImage);
	gl.uniform1i(programInfo.uniformLocations.sBackground, 0);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_3D, noiseTexture);
	gl.uniform1i(programInfo.uniformLocations.sCloudNoise, 1);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	canvas.classList.add("in");
	setTimeout(function () {
		canvas.classList.remove("fade", "in");
	}, 1500);
	return true;
}
let fullscreenChangedTimeout = 0;
function fullscreenChangedHandler() {
	fullscreenChangedTimeout = 0;
	if (screen["mozLockOrientation"] && screen["mozUnlockOrientation"]) {
		try {
			if (FullscreenControl.fullscreenMode) {
				if (screen["mozLockOrientation"]("landscape-primary"))
					return;
			}
			else {
				if (screen["mozUnlockOrientation"]())
					return;
			}
		}
		catch (ex) {
		}
	}
	if (screen["msLockOrientation"] && screen["msUnlockOrientation"]) {
		try {
			if (FullscreenControl.fullscreenMode) {
				if (screen["msLockOrientation"]("landscape-primary"))
					return;
			}
			else {
				if (screen["msUnlockOrientation"]())
					return;
			}
		}
		catch (ex) {
		}
	}
	if (screen.orientation && ("lock" in screen.orientation) && ("unlock" in screen.orientation)) {
		try {
			ignorePromise(FullscreenControl.fullscreenMode ?
				screen.orientation.lock("landscape-primary") :
				screen.orientation.unlock());
		}
		catch (ex) {
		}
	}
}
function fullscreenChanged(e) {
	if (fullscreenChangedTimeout) {
		clearTimeout(fullscreenChangedTimeout);
		fullscreenChangedTimeout = 0;
	}
	try {
		if (FullscreenControl.fullscreenMode)
			fullscreenChangedTimeout = setTimeout(fullscreenChangedHandler, 150);
		else
			fullscreenChangedHandler();
	}
	catch (ex) {
	}
}
function adjustWindowSize() {
	let widthCss = window.innerWidth;
	let heightCss = window.innerHeight;
	if (document.documentElement && ("clientWidth" in document.documentElement)) {
		widthCss = document.documentElement.clientWidth;
		heightCss = document.documentElement.clientHeight;
	}
	if (isIOSOrSafari) {
		let bodyRect = null;
		if (document.documentElement && ("getBoundingClientRect" in document.documentElement))
			bodyRect = document.documentElement.getBoundingClientRect();
		else if (("getBoundingClientRect" in document.body))
			bodyRect = document.body.getBoundingClientRect();
		if (bodyRect) {
			widthCss = bodyRect.right - bodyRect.left;
			heightCss = bodyRect.bottom - bodyRect.top;
		}
	}
	const currentRatio = widthCss / heightCss, desiredRatio = baseWidth / baseHeight;
	let baseWidthCss = 0;
	let baseHeightCss = 0;
	let scaleFactor = 1;
	if (currentRatio >= desiredRatio) {
		baseHeightCss = heightCss;
		scaleFactor = heightCss / baseHeight;
		baseWidthCss = baseWidth * scaleFactor;
	}
	else {
		baseWidthCss = widthCss;
		scaleFactor = widthCss / baseWidth;
		baseHeightCss = baseHeight * scaleFactor;
	}
	canvas.style.width = baseWidthCss + "px";
	canvas.style.height = baseHeightCss + "px";
}
async function setup() {
	if (!(await setupWebGL()))
		return;
	FullscreenControl.onfullscreenchange = fullscreenChanged;
	adjustWindowSize();
	window.onresize = adjustWindowSize;
	canvas.onclick = function () { FullscreenControl.toggleFullscreen(); };
	let time = 0;
	let offsetX = 0;
	let offsetY = 0;
	function render() {
		time += (1 / 64);
		if (time >= noiseResolution)
			time = 0;
		offsetX += 0.001;
		if (offsetX >= 4.0)
			offsetX = 0;
		offsetY -= 0.0005;
		if (offsetY <= 0.0)
			offsetY = 4.0;
		gl.uniform1f(programInfo.uniformLocations.uTime, time / noiseResolution);
		gl.uniform2f(programInfo.uniformLocations.uOffset, offsetX, offsetY);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		requestAnimationFrame(render);
	}
	render();
}
setup().catch(function (reason) {
	if (!reason)
		reason = "Unknown error";
	else if (reason.message)
		reason = reason.message;
	alert(reason);
});
