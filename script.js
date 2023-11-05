// *** AUDIO HANDLING AND PARSING *** //


// Create new audio object
let audioObj = new Audio();

// Format the HTML canvas
const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;   // Full width of window
canvas.height = window.innerHeight; // Full height of window
const ctx = canvas.getContext("2d"); // Get the 2D rendering context for the canvas to allow for drawing on the canvas

// Initialize the web audio context (main audio handler)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioSource = audioCtx.createMediaElementSource(audioObj);
let analyser = audioCtx.createAnalyser();
let gainNode = audioCtx.createGain();

// Connect the audio source to the audio handler
audioSource.connect(analyser); // Connect the source to the analyser
analyser.connect(gainNode);   // Then connect the analyser to the gain node
gainNode.connect(audioCtx.destination); // And finally connect the gain node to the destination


// Apply the Fast Fourier Transformation algorithm - converts audio signal into frequency components
analyser.fftSize = 2048;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength); // dataArray holds the frequency data


// *** CANVAS ANIMATION *** //


// Using HSV color model to better describe frequencies in hues; function converts to RGB
function hsvToRgb(h, s, v) {
  let r, g, b, i, f, p, q, t;
  if (s === 0) {
      r = g = b = v; // Achromatic (grey)
  } else {
      h /= 60; // sector 0 to 5
      i = Math.floor(h);
      f = h - i; // factorial part of h
      p = v * (1 - s);
      q = v * (1 - s * f);
      t = v * (1 - s * (1 - f));
      switch (i) {
          case 0:
              r = v;
              g = t;
              b = p;
              break;
          case 1:
              r = q;
              g = v;
              b = p;
              break;
          case 2:
              r = p;
              g = v;
              b = t;
              break;
          case 3:
              r = p;
              g = q;
              b = v;
              break;
          case 4:
              r = t;
              g = p;
              b = v;
              break;
          default: // case 5:
              r = v;
              g = p;
              b = q;
              break;
      }
  }
  return {
      red: Math.round(r * 255),
      green: Math.round(g * 255),
      blue: Math.round(b * 255)
  };
}


// Defines the visual representations of audio frequencies - creates an aura-like effect
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * canvas.width + 400;     // Set a random initial radius for the particle, with a min
        
        // Initialize the particle with a random color
        this.color = color;

        this.alpha = 0.1;  // Set the starting alpha channel (opacity) of the particle
        this.maxAlpha = 0.8 + Math.random() * 0.2;  // Maximum alpha value for the fade-in
        this.fadeIn = 0.005 + Math.random() * 0.01; // Rate at which the particle fades in to maxAlpha
        this.fadeOut = 0.005 + Math.random() * 0.01;   // Fade-out rate
        this.fadingIn = true; // State to determine if the particle is currently fading in
    }

    // Draw a new particle onto the canvas
    draw() {
        // Create a radial gradient for the particle's appearance - this is the heavy lifting for the aura effect
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, `rgba(${this.color.red}, ${this.color.green}, ${this.color.blue}, ${this.alpha})`);
        gradient.addColorStop(1, `rgba(${this.color.red}, ${this.color.green}, ${this.color.blue}, 0)`);

        ctx.save();     // Save canvas's current state
        ctx.globalAlpha = this.alpha;
        // Draw the particle as an arc (circle)
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        // Fill the circle with the gradient
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();  // Restore canvas state, with new particle
    }

    // Update the particle to add a pulsing effect
    update() {
        this.draw();

        // Fade-in - increase opacity up to max, then pass to fade-out
        if (this.fadingIn) {
            this.alpha += this.fadeIn;
            if (this.alpha >= this.maxAlpha) {
                this.alpha = this.maxAlpha; // Error handle: ensure alpha does not exceed maxAlpha
                this.fadingIn = false;
            }
        } else {    // Fade-out
            this.alpha -= this.fadeOut;
        }

        this.radius += 0.2;     // Make the particle grow.

        // Remove the particle once alpha is 0 (or less)
        if (this.alpha <= 0) {
            this.alpha = 0;
        }
    }
}

let particles = [];
let generateParticles = true;
// Driver for the particle animation that updates the canvas.
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    analyser.getByteFrequencyData(dataArray);   // Get the current frequency data from the analyser.

    const numberOfSegments = 3; // low, mid, high frequencies
    const segmentSize = Math.floor(dataArray.length / numberOfSegments);
    const averages = [];

    // Average the frequencies based on defined ranges
    for (let i = 0; i < numberOfSegments; i++) {
      let sum = 0;
      for (let j = i * segmentSize; j < (i + 1) * segmentSize; j++) {
        sum += dataArray[j];
      }
      let average = sum / segmentSize;
      averages.push(average);
    }
    
    // Lower frequencies - reds and oranges
    let lowFrequencyHue = Math.round((averages[0] / 255) * 160);
    // Mid frequencies - greens
    let midFrequencyHue = 160 + Math.round(((averages[1] / 255) * 170));
    // Higher frequencies - blues and purples
    let highFrequencyHue = 170 + Math.round(((averages[2] / 255) * 70));
  
    // Blend the hues based on their amplitude
    let totalAmplitude = averages.reduce((acc, val) => acc + val, 0);
    if (totalAmplitude === 0) totalAmplitude = 1; // to avoid division by zero


    // Calculate the weight of each frequency range, skewed
    let lowWeight = averages[0] / totalAmplitude * 1.5;
    let midWeight = averages[1] / totalAmplitude * 0.6;
    let highWeight = averages[2] / totalAmplitude * 2;

    let blendedHue = (lowFrequencyHue * lowWeight) + (midFrequencyHue * midWeight) + (highFrequencyHue * highWeight);     // Blend the hues based on their weights
    let saturation = Math.min(100, 100 - (blendedHue / 360) * 100);    // Saturation value decreases with frequency
    let value = 85;    // Assume a constant value (brightness)

    let color = hsvToRgb(blendedHue, saturation / 100, value / 100);


    if (generateParticles && particles.length < 10) { // Allow only 10 particles at a time for performance
        // Create a new particle at a random position and add it to the array
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        particles.push(new Particle(x, y, color)); 
    }

    // Display each particle in the particles array
    particles.forEach((particle, index) => {
        // Error check: if the particle's opacity is 0 or less, remove it
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
        }
    });

    requestAnimationFrame(animate);    // Request the next animation frame, causing the animate function to be called again
}


// *** FILE INPUT *** //


// Change the background color as prep for animate
function changeContainerBackground(toBlack = true) {
  const container = document.getElementById('container');
  if (toBlack) {
    container.classList.add('bg-black', 'opacity-100'); // Adds black background
  } else {
    container.classList.remove('bg-black', 'opacity-100'); // Removes black background
  }
}

// Event listener for the file input - starts the animation
document.getElementById('file_input').addEventListener('change', function(e) {
  const file = e.target.files[0]; // Triggers when a file is selected

  if (file) {
    // Create an object URL from the file
    const url = URL.createObjectURL(file);
    audioObj.src = url;

    // Play the updated audio source
    audioObj.play().then(() => {
      // If the play promise is resolved, start the animation
      document.querySelector('.flex.justify-center.items-center').classList.add('hidden');
      changeContainerBackground();
      animate();
    }).catch((error) => {
      console.error('Error playing audio:', error);
    });

    // Resume the audio context (if needed), start the animation
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        changeContainerBackground();
        animate();
      });
    } else {
      changeContainerBackground();
      animate();
    }
  }
});


// *** MISC EVENT LISTENERS *** //


// Event listener for when the audio finishes playing
audioObj.addEventListener('ended', function() {
  generateParticles = false;
});

const volumeSlider = document.getElementById('volume-slider');
// Event listener for the volume slider
volumeSlider.addEventListener('input', function(e) {
  const linearValue = e.target.value;
  const logValue = Math.pow(linearValue, 2); // Curve volume controls for more pronounced differences
  gainNode.gain.value = logValue;
});

