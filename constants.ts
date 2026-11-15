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

const isIOSOrSafari = (function () {
		// https://stackoverflow.com/q/9038625/3569421
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
	})(),
	baseWidth = 1280,
	baseHeight = 720,
	noiseResolution = 128;
