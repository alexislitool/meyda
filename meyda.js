// Meyda Javascript DSP library

var Meyda = function(audioContext,source,bufferSize){
	//add some utilities to array prototype
	Float32Array.prototype.meanValue = function() {
		var sum = 0;
		for(var i = 0; i < this.length; i++){
		    sum += parseInt(this[i], 10);
		}

		return sum/this.length;
	};

	var self = this;

	var µ = function(i, amplitudeSpect){
		var numerator = 0;
		var denominator = 0;
		for(var k = 0; k < amplitudeSpect.length-1; k++){
			numerator += Math.pow(k,i)*amplitudeSpect[k];
			denominator += amplitudeSpect[k];
		}
		return numerator/denominator;
	}

	self.featureExtractors = {
		"buffer" : function(bufferSize,m,spectrum, signal){
			return signal;
		},
		"rms": function(bufferSize, m, spectrum, signal){
			var rms = 0;
			for(var i = 0 ; i < signal.length ; i++){
				rms += Math.pow(signal[i],2);
			}
			rms = rms / signal.length;
			rms = Math.sqrt(rms);
			return rms;
		},
		"energy": function(bufferSize, m, spectrum, signal) {
			var energy = 0;
			for(var i = 0 ; i < signal.length ; i++){
				energy += Math.pow(Math.abs(signal[i]),2);
			}
			return energy;
		},
		"spectrum": function(bufferSize, m, spectrum) {
			return spectrum;
		},
		"spectralSlope": function(bufferSize, m, spectrum) {
			//linear regression
			var x = 0.0, y = 0.0, xy = 0.0, x2 = 0.0;
			for (var i = 0; i < spectrum.length; i++) {
				y += spectrum[i];
				xy += spectrum[i] * i;
				x2 += i*i;
			};

			x = spectrum.length/2;
			y /= spectrum.length;
			xy /= spectrum.length;
			x2 /= spectrum.length;

			return (x*y - xy)/(x*x - x2);
		},
		"spectralCentroid": function(bufferSize, m, spectrum){
			return µ(1,m.featureExtractors.amplitudeSpectrum(bufferSize,m,spectrum));
		},
		"spectralRolloff": function(bufferSize, m, spectrum){
			var magspec = m.featureExtractors.amplitudeSpectrum(bufferSize, m, spectrum);
			var ec = 0;
			for(var i = 0; i < magspec.length; i++){
				ec += magspec[i];
			}
			var threshold = 0.99 * ec;
			var n = magspec.length - 1;
			while(ec > threshold && n >= 0){
				ec -= magspec[n];
            	n--;
			}
			return ec;
		},
		"spectralFlatness": function(bufferSize, m, spectrum){
			var powspec = m.featureExtractors.powerSpectrum(bufferSize, m, spectrum);
			var numerator = 0;
			var denominator = 0;
			for(var i = 0; i < powspec.length-1;i++){
				numerator += Math.log(powspec[i]);
				denominator += powspec[i];
			}
			return Math.exp((1/powspec.length)*numerator)/((1/powspec.length)*denominator);
		},
		"spectralSpread": function(bufferSize, m, spectrum){
			var magspec = m.featureExtractors.amplitudeSpectrum(bufferSize, m, spectrum);
			return Math.sqrt(µ(2,magspec)-Math.pow(µ(1,magspec),2));
		},
		"spectralSkewness": function(bufferSize, m, spectrum){
			var magspec = m.featureExtractors.amplitudeSpectrum(bufferSize, m, spectrum);
			var µ1 = µ(1,magspec);
			var µ2 = µ(2,magspec);
			var µ3 = µ(3,magspec);
			var numerator = 2*Math.pow(µ1,3)-3*µ1*µ2+µ3;
			var denominator = Math.pow(Math.sqrt(µ2-Math.pow(µ1,2)),3);
			return numerator/denominator;
		},
		"spectralKurtosis": function(bufferSize, m, spectrum){
			var magspec = m.featureExtractors.amplitudeSpectrum(bufferSize, m, spectrum);
			var µ1 = µ(1,magspec);
			var µ2 = µ(2,magspec);
			var µ3 = µ(3,magspec);
			var µ4 = µ(4,magspec);
			var numerator = -3*Math.pow(µ1,4)+6*µ1*µ2-4*µ1*µ3+µ4;
			var denominator = Math.pow(Math.sqrt(µ2-Math.pow(µ1,2)),4);
			return numerator/denominator;
		},
		"amplitudeSpectrum": function(bufferSize, m, spectrum){
			var ampRatioSpectrum = new Float32Array(spectrum.length);
			for (var i = 0; i < spectrum.length; i++) {
				ampRatioSpectrum[i] =  Math.pow(10,spectrum[i]/20);

			}
			return ampRatioSpectrum;
		},
		"zcr": function(bufferSize, m, spectrum, signal){
			var zcr = 0;
			for(var i = 0; i < signal.length; i++){
				if((signal[i] >= 0 && signal[i+1] < 0) || (signal[i] < 0 && signal[i+1] >= 0)){
					zcr++;
				}
			}
			return zcr;
		},
		"powerSpectrum": function(bufferSize, m, spectrum){
			var powerRatioSpectrum = new Float32Array(spectrum.length);
			for (var i = 0; i < spectrum.length; i++) {
				powerRatioSpectrum[i] =  Math.pow(10,spectrum[i]/10);

			}
			return powerRatioSpectrum;
		},
		"loudness": function(bufferSize, m, spectrum){
			var barkScale = Float32Array(bufferSize);
			var NUM_BARK_BANDS = 24;
			var spec = Float32Array(NUM_BARK_BANDS);
			var tot = 0;
			var normalisedSpectrum = m.featureExtractors["amplitudeSpectrum"](bufferSize, m, spectrum);

			for(var i = 0; i < barkScale.length; i++){
				barkScale[i] = i*m.audioContext.sampleRate/(bufferSize);
				barkScale[i] = 13*Math.atan(barkScale[i]/1315.8) + 3.5* Math.atan(Math.pow(barkScale[i]/7518,2));
			}

			var bbLimits = [0];
			var currentBandEnd = barkScale[bufferSize-1]/NUM_BARK_BANDS;
			var currentBand = 1;
			for(var i = 0; i<bufferSize; i++){
				while(barkScale[i] > currentBandEnd){
					bbLimits[currentBand] = i;
					currentBand++;
					currentBandEnd = (currentBand*barkScale[bufferSize-1])/NUM_BARK_BANDS;
				}
			}

			bbLimits[NUM_BARK_BANDS] = bufferSize-1;

			for (var i = 1; i <= NUM_BARK_BANDS; i++){
				var sum = 0;
				for (var j = bbLimits[i-1] ; j < bbLimits[i] ; j++) {

					sum += normalisedSpectrum[j];
				}
				spec[i] = Math.pow(sum,0.23);
			}

			for (var i = 0; i < spec.length; i++){
				tot += spec[i];
			}


			return {
				specific: spec,
				total: tot
			};
		},
		"perceptualSpread": function(bufferSize, m, spectrum) {
			var loudness = m.featureExtractors["loudness"](bufferSize, m, spectrum);

			var max = 0;
			for (var i=0; i<loudness.specific.length; i++) {
				if (loudness.specific[i] > max) {
					max = loudness.specific[i];
				}
			}

			var spread = Math.pow((loudness.total - max)/loudness.total, 2);

			return spread;
		},
		"perceptualSharpness": function(bufferSize,m,spectrum) {
			var loudness = m.featureExtractors["loudness"](bufferSize, m, spectrum);
			var spec = loudness.specific;
			var output = 0;

			for (var i = 0; i < spec.length; i++) {
				if (i < 15) {
					output += (i+1) * spec[i+1];
				}
				else {
					output += 0.066 * Math.exp(0.171 * (i+1));
				}
			};
			output *= 0.11/loudness.total;

			return output;
		},
		"mfcc": function(bufferSize, m, spectrum){
			//used tutorial from http://practicalcryptography.com/miscellaneous/machine-learning/guide-mel-frequency-cepstral-coefficients-mfccs/
			var powSpec = m.featureExtractors["powerSpectrum"](bufferSize, m, spectrum);
			var freqToMel = function(freqValue){
				var melValue = 1125*Math.log(1+(freqValue/700));
				return melValue
			};
			var melToFreq = function(melValue){
				var freqValue = 700*(Math.exp(melValue/1125)-1);
				return freqValue;
			};
			var numFilters = 26; //26 filters is standard
			var melValues = Float32Array(numFilters);
			var melValuesInFreq = Float32Array(numFilters);
			var lowerLimitFreq = 0;
			var upperLimitFreq = audioContext.sampleRate/2;
			var lowerLimitMel = freqToMel(lowerLimitFreq);
			var upperLimitMel = freqToMel(upperLimitFreq);

			var range = upperLimitMel-lowerLimitMel;
			var valueToAdd = range/(numFilters-1);

			var fftBinsOfFreq = Array(numFilters);
			for (var i = 0; i < melValues.length; i++) {
				melValues[i] = i*valueToAdd;
				melValuesInFreq[i] = melToFreq(melValues[i]);
				fftBinsOfFreq[i] = Math.floor((bufferSize+1)*melValuesInFreq[i]/audioContext.sampleRate);
			};

			var filterBank = Array(numFilters);
			for (var j = 0; j < filterBank.length; j++) {
				//creating a two dimensional array of size numFiltes * (buffersize/2)+1 and pre-populating the arrays with 0s.
				filterBank[j] = Array.apply(null, new Array((bufferSize/2)+1)).map(Number.prototype.valueOf,0); 
				for (var i = fftBinsOfFreq[j]; i < fftBinsOfFreq[j+1]; i++) {
					filterBank[j][i] = (i - fftBinsOfFreq[j])/(fftBinsOfFreq[j+1]-fftBinsOfFreq[j]);
				}
				for (var i = fftBinsOfFreq[j+1]; i < fftBinsOfFreq[j+2]; i++) {
					filterBank[j][i] = (fftBinsOfFreq[j+2]-i)/(fftBinsOfFreq[j+2]-fftBinsOfFreq[j+1]) 
				}
			}

			var mfcc = Array.apply(null, new Array(numFilters)).map(Number.prototype.valueOf,0);
			for (var i = 0; i < mfcc.length; i++) {
				for (var j = 0; j < ((bufferSize/2)+1); j++) {
					filterBank[i][j] = filterBank[i][j]*powSpec[i];
					mfcc[i] += filterBank[i][j];
				}
				mfcc[i] = Math.log(mfcc[i]); 
			}

			for (var k = 0; k < mfcc.length; k++) {
				var v = 0;
				for (var n = 0; n < mfcc.length-1; n++) {
					v += mfcc[n]*Math.cos(Math.PI*k*(2*n+1)/(2*mfcc.length));
				}
				mfcc[k] = v;
			}
			return mfcc;
		}
	}
	//create nodes
	self.analyser = audioContext.createAnalyser();
	self.analyser.fftSize = bufferSize;
	self.audioContext = audioContext;

	self.get = function(feature) {

		var spectrum = new Float32Array(bufferSize/2);
		self.analyser.getFloatFrequencyData(spectrum);

		var signal = new Float32Array(bufferSize);
		self.analyser.getFloatTimeDomainData(signal);

		if(typeof feature === "object"){
			var results = {};
			for (var x = 0; x < feature.length; x++){
				try{
					results[feature[x]] = (self.featureExtractors[feature[x]](bufferSize, self, spectrum, signal));
				} catch (e){
					console.error(e);
				}
			}
			return results;
		}
		else if (typeof feature === "string"){
			return self.featureExtractors[feature](bufferSize, self, spectrum, signal);
		}
		else{
			throw "Invalid Feature Format";
		}
	}
	source.connect(self.analyser);
	return self;
}

