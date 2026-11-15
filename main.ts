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

let fullscreenChangedTimeout = 0;

function fullscreenChangedHandler(): void {
	fullscreenChangedTimeout = 0;
	// https://www.w3.org/TR/screen-orientation/#locking-to-a-specific-orientation-and-unlocking
	// https://developer.mozilla.org/en-US/docs/Web/API/Screen/orientation
	// https://developer.mozilla.org/en-US/docs/Web/API/Screen/lockOrientation
	if ((screen as any)["mozLockOrientation"] && (screen as any)["mozUnlockOrientation"]) {
		try {
			if (FullscreenControl.fullscreenMode) {
				if ((screen as any)["mozLockOrientation"]("landscape-primary"))
					return;
			} else {
				if ((screen as any)["mozUnlockOrientation"]())
					return;
			}
		} catch (ex: any) {
			// Just ignore...
		}
	}
	if ((screen as any)["msLockOrientation"] && (screen as any)["msUnlockOrientation"]) {
		try {
			if (FullscreenControl.fullscreenMode) {
				if ((screen as any)["msLockOrientation"]("landscape-primary"))
					return;
			} else {
				if ((screen as any)["msUnlockOrientation"]())
					return;
			}
		} catch (ex: any) {
			// Just ignore...
		}
	}
	if (screen.orientation && ("lock" in screen.orientation) && ("unlock" in screen.orientation)) {
		try {
			ignorePromise(FullscreenControl.fullscreenMode ?
				(screen.orientation as any).lock("landscape-primary") :
				// Are there browsers out there returning a promise here?!?!
				screen.orientation.unlock());
		} catch (ex: any) {
			// For those browsers that do not support lock(), but
			// fail to return a proper Promise...
		}
	}
}

function fullscreenChanged(e: Event): void {
	if (fullscreenChangedTimeout) {
		clearTimeout(fullscreenChangedTimeout);
		fullscreenChangedTimeout = 0;
	}

	try {
		if (FullscreenControl.fullscreenMode)
			fullscreenChangedTimeout = setTimeout(fullscreenChangedHandler, 150);
		else
			fullscreenChangedHandler();
	} catch (ex: any) {
		// Just ignore...
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

	const currentRatio = widthCss / heightCss,
		desiredRatio = baseWidth / baseHeight;

	let baseWidthCss = 0;
	let baseHeightCss = 0;
	let scaleFactor = 1;

	if (currentRatio >= desiredRatio) {
		baseHeightCss = heightCss;
		scaleFactor = heightCss / baseHeight;
		baseWidthCss = baseWidth * scaleFactor;
	} else {
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

		// Both offsets must be multiplied by 4, because of the * 0.25
		// used when sampling the first frequency
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

setup().catch(console.error);
