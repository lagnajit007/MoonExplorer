import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/DRACOLoader.js";
import * as dat from 'https://cdn.skypack.dev/dat.gui';
import { RGBELoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/RGBELoader.js';
import { CSS2DObject } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// Constants
const CAMERA_FOV = 55;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 12000;
const RENDERER_ALPHA = true;
const LIGHT_COLOR = 0xffffff;
const LIGHT_INTENSITY = 1;
const AMBIENT_LIGHT_INTENSITY = 0.3;
const CAMERA_HEIGHT = 5;
const GRAVITY_STRENGTH = 0;
const COLLISION_PADDING = 2;
const MAX_SLOPE = Math.PI / 3;
const SHAKE_INTENSITY = 1;
const SHAKE_DECAY = 0.95;
const SHAKE_THRESHOLD_SPEED = 5;
const SMOOTHING_FACTOR = 0.15;
const ROTATION_SMOOTHING = 0.1;

// Create scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0e17, 0.0005);

// Setup lighting
const ambientLight = new THREE.AmbientLight(LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(LIGHT_COLOR, LIGHT_INTENSITY);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// Create camera
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
camera.position.set(1799, 5500, 5000);

// Minimap camera and renderer
const minimapCamera = new THREE.PerspectiveCamera(75, 1, CAMERA_NEAR, CAMERA_FAR);
minimapCamera.position.set(0, 10000, 0);
minimapCamera.lookAt(0, 0, 0);
minimapCamera.up.set(0, 0, -1);

const minimapRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
minimapRenderer.setSize(200, 200);
minimapRenderer.setClearColor(0x000000, 0);
minimapRenderer.outputEncoding = THREE.sRGBEncoding;

// Create renderer
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  alpha: RENDERER_ALPHA 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;

// Add bloom effect
const bloomParams = {
  exposure: 1,
  bloomStrength: 0.5,
  bloomThreshold: 0,
  bloomRadius: 0.5
};

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  bloomParams.bloomStrength,
  bloomParams.bloomRadius,
  bloomParams.bloomThreshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Add renderer to DOM
const container = document.getElementById("container3D");
if (container) {
  container.appendChild(renderer.domElement);
  
  // Add minimap to DOM
  const minimapElement = document.getElementById("minimap");
  if (minimapElement) {
    minimapElement.appendChild(minimapRenderer.domElement);
  }
}

// Loading manager for progress tracking
const loadingManager = new THREE.LoadingManager(
  () => {
    setTimeout(() => {
      document.getElementById('loading-screen').style.opacity = '0';
      setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('BgSound').play();
      }, 1000);
    }, 500);
  },
  (item, loaded, total) => {
    const progress = (loaded / total) * 100;
    document.querySelector('.progress-bar').style.width = `${progress}%`;
    document.querySelector('.progress-text').textContent = `${Math.round(progress)}%`;
  }
);

// Draco loader for compressed models
const dracoLoader = new DRACOLoader(loadingManager);
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');

// GLTF loader with Draco
const loader = new GLTFLoader(loadingManager);
loader.setDRACOLoader(dracoLoader);

// Variables for objects
let moonObject;
let roverObject;
let hotspots = [];
let waypoints = [];

// Load moon model
loader.load(
  `models/moon_try_1.glb`,
  (gltf) => {
    moonObject = gltf.scene;
    moonObject.scale.set(1000, 1000, 1000);
    moonObject.position.set(0, 0, 0);

    // Optimize materials
    moonObject.traverse((child) => {
      if (child.isMesh) {
        child.material.roughness = 500;
        child.material.metalness = 0;
        child.material.envMapIntensity = 1;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(moonObject);
    addRandomRocks();
    loadRoverModel();
    addWaypoints();
    positionCameraOnSurface();
  },
  (xhr) => {
    const progress = (xhr.loaded / xhr.total) * 100;
    document.querySelector('.progress-bar').style.width = `${progress}%`;
    document.querySelector('.progress-text').textContent = `${Math.round(progress)}%`;
  },
  (error) => {
    console.error(error);
    document.querySelector('.progress-text').textContent = "Error loading model";
  }
);

// Load rover model
function loadRoverModel() {
  loader.load(
    `models/nasaRover.glb`,
    (gltf) => {
      roverObject = gltf.scene;
      roverObject.scale.set(50, 50, 50);
      roverObject.position.set(1000, 5350, 2000);
      roverObject.rotation.y = Math.PI / 2;
      
      roverObject.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      scene.add(roverObject);
      
      // Add hotspot for rover
      addHotspot(roverObject.position, "NASA Rover", 0xff0000);
    },
    undefined,
    (error) => {
      console.error("Error loading rover model:", error);
    }
  );
}

// Optimized rock generation
function addRandomRocks() {
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.8,
    metalness: 0.2,
    envMapIntensity: 1
  });

  const numRocks = 500;
  const moonRadius = 1000;
  const rocks = new THREE.Group();

  for (let i = 0; i < numRocks; i++) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1) * 0.8;
    const x = moonRadius * Math.sin(phi) * Math.cos(theta);
    const y = moonRadius * Math.sin(phi) * Math.sin(theta);
    const z = moonRadius * Math.cos(phi);

    rock.position.set(x, y, z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    
    const scale = Math.random() * 10 + 1;
    rock.scale.set(scale, scale, scale);
    
    rocks.add(rock);
  }
  
  scene.add(rocks);
}

// Waypoints system
function addWaypoints() {
  waypoints = [
    { name: "Crater Alpha", position: new THREE.Vector3(1000, 5350, 2000), color: 0xff0000 },
    { name: "Ridge Beta", position: new THREE.Vector3(-2000, 5350, 3000), color: 0x00ff00 },
    { name: "Valley Gamma", position: new THREE.Vector3(1500, 5350, -2000), color: 0x0000ff }
  ];

  waypoints.forEach((wp) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(15, 16, 16),
      new THREE.MeshBasicMaterial({ color: wp.color })
    );
    marker.position.copy(wp.position);
    scene.add(marker);
    
    // Add label
    const label = document.createElement('div');
    label.className = 'waypoint-label';
    label.textContent = wp.name;
    label.style.color = `rgb(${wp.color >> 16}, ${(wp.color >> 8) & 0xff}, ${wp.color & 0xff})`;
    
    const labelObj = new CSS2DObject(label);
    labelObj.position.copy(wp.position);
    labelObj.position.y += 50;
    scene.add(labelObj);
    
    // Add hotspot for waypoint
    if (wp.name !== "NASA Rover") {
      addHotspot(wp.position, wp.name, wp.color);
    }
  });
}

// Add interactive hotspots
function addHotspot(position, name, color) {
  const hotspot = {
    position: position.clone(),
    name: name,
    color: color,
    mesh: new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 16),
      new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.5
      })
    )
  };
  
  hotspot.mesh.position.copy(position);
  hotspot.mesh.visible = false; // Initially hidden
  scene.add(hotspot.mesh);
  hotspots.push(hotspot);
}

// Camera positioning
function positionCameraOnSurface() {
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 5500, 5000), new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(moonObject, true);

  if (intersects.length > 0) {
    const groundPoint = intersects[0].point;
    const groundNormal = intersects[0].face.normal.clone().applyQuaternion(intersects[0].object.quaternion);
    camera.position.copy(groundPoint.clone().add(groundNormal.multiplyScalar(CAMERA_HEIGHT)));
    camera.lookAt(groundPoint.clone().add(groundNormal));
  }
}

// Movement and controls
let keys = {};
let moveSpeed = 40;
const rotateSpeed = 0.002;
let isRotating = false;
let previousMousePosition = { x: 0, y: 0 };
let shakeOffset = new THREE.Vector3();
let previousPosition = new THREE.Vector3();
let currentVelocity = new THREE.Vector3();
let targetPosition = new THREE.Vector3();
let smoothedPosition = new THREE.Vector3();
let targetQuaternion = new THREE.Quaternion();
let mouseDown = false;

// Boundaries
const minX = -3750;
const maxX = 1800;
const minZ = -3050;
const maxZ = 5450;
const minY = 5350;
const maxY = 10000;

// Event listeners
window.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
  if (event.key === 'Shift') {
    moveSpeed = 80;
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
  if (event.key === 'Shift') {
    moveSpeed = 40;
  }
});

window.addEventListener('mousedown', (event) => {
  if (event.button === 1) {
    isRotating = true;
    mouseDown = true;
  }
  
  // Check for hotspot clicks
  if (event.button === 0) {
    checkHotspotClick(event);
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 1) {
    isRotating = false;
    mouseDown = false;
  }
});

window.addEventListener('mousemove', (event) => {
  if (isRotating && mouseDown) {
    const deltaMove = {
      x: event.clientX - previousMousePosition.x,
      y: event.clientY - previousMousePosition.y
    };

    camera.rotation.y -= deltaMove.x * rotateSpeed;
    camera.rotation.x -= deltaMove.y * rotateSpeed;
    // Remove rotation limits for full freedom
  }

  // Show/hide hotspots based on mouse position
  checkHotspotHover(event);

  previousMousePosition = { x: event.clientX, y: event.clientY };
});

// Check for hotspot clicks
function checkHotspotClick(event) {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(hotspots.map(h => h.mesh));
  
  if (intersects.length > 0) {
    const clickedHotspot = hotspots.find(h => h.mesh === intersects[0].object);
    if (clickedHotspot) {
      alert(`Clicked on ${clickedHotspot.name}`);
    }
  }
}

// Check for hotspot hover
function checkHotspotHover(event) {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(hotspots.map(h => h.mesh));
  
  // Hide all hotspots first
  hotspots.forEach(h => h.mesh.visible = false);
  
  // Show only the intersected hotspot
  if (intersects.length > 0) {
    intersects[0].object.visible = true;
  }
}

// Update camera position and telemetry
function updateCamera() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  let movementVector = new THREE.Vector3();

  if (keys['w']) movementVector.add(direction.clone().multiplyScalar(moveSpeed));
  if (keys['s']) movementVector.sub(direction.clone().multiplyScalar(moveSpeed));
  if (keys['a']) movementVector.add(direction.cross(camera.up).normalize().multiplyScalar(-moveSpeed));
  if (keys['d']) movementVector.add(direction.cross(camera.up).normalize().multiplyScalar(moveSpeed));

  targetPosition.copy(camera.position).add(movementVector);
  targetPosition.x = Math.max(minX, Math.min(maxX, targetPosition.x));
  targetPosition.z = Math.max(minZ, Math.min(maxZ, targetPosition.z));
  targetPosition.y = Math.max(minY, Math.min(maxY, targetPosition.y));

  // Check collision with rover
  if (roverObject) {
    const roverBox = new THREE.Box3().setFromObject(roverObject);
    const cameraBox = new THREE.Box3().setFromCenterAndSize(
      targetPosition, 
      new THREE.Vector3(COLLISION_PADDING * 2, COLLISION_PADDING * 2, COLLISION_PADDING * 2)
    );
    
    if (roverBox.intersectsBox(cameraBox)) {
      // Push back from rover
      const pushDirection = targetPosition.clone().sub(roverObject.position).normalize();
      targetPosition.copy(roverObject.position).add(pushDirection.multiplyScalar(100));
    }
  }

  // Raycast for ground detection
  const raycaster = new THREE.Raycaster(targetPosition.clone().add(new THREE.Vector3(0, 100, 0)), new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(moonObject, true);

  if (intersects.length > 0) {
    const groundPoint = intersects[0].point;
    const groundNormal = intersects[0].face.normal.clone().applyQuaternion(intersects[0].object.quaternion);

    if (groundNormal.angleTo(new THREE.Vector3(0, 1, 0)) <= MAX_SLOPE) {
      const desiredPosition = groundPoint.clone().add(groundNormal.multiplyScalar(CAMERA_HEIGHT));
      targetPosition.lerp(desiredPosition, GRAVITY_STRENGTH);

      const distanceToGround = targetPosition.distanceTo(groundPoint);
      if (distanceToGround < CAMERA_HEIGHT + COLLISION_PADDING) {
        targetPosition.copy(groundPoint.clone().add(groundNormal.multiplyScalar(CAMERA_HEIGHT + COLLISION_PADDING)));
      }

      targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), groundNormal);
    }
  }

  smoothedPosition.lerp(targetPosition, SMOOTHING_FACTOR);
  camera.position.copy(smoothedPosition);
  camera.quaternion.slerp(targetQuaternion, ROTATION_SMOOTHING);

  currentVelocity.subVectors(camera.position, previousPosition);
  const speed = currentVelocity.length();

  // Update telemetry
  updateTelemetry(camera.position, speed);

  // Camera shake
  if (speed > SHAKE_THRESHOLD_SPEED) {
    const shakeAmount = Math.min((speed - SHAKE_THRESHOLD_SPEED) / 50, 1) * SHAKE_INTENSITY;
    shakeOffset.set(
      (Math.random() - 0.5) * shakeAmount,
      (Math.random() - 0.5) * shakeAmount,
      (Math.random() - 0.5) * shakeAmount
    );
    camera.position.add(shakeOffset);
    shakeOffset.multiplyScalar(SHAKE_DECAY);
  }

  previousPosition.copy(camera.position);
}

// Update telemetry display
function updateTelemetry(position, speed) {
  document.getElementById('position-value').textContent = 
    `${Math.round(position.x)}, ${Math.round(position.y)}, ${Math.round(position.z)}`;
  
  document.getElementById('elevation-value').textContent = 
    `${Math.round(position.y - 5350)}m`;
  
  document.getElementById('speed-value').textContent = 
    `${Math.round(speed * 10)} km/h`;
  
  document.querySelector('.compass-arrow').style.transform = `rotate(${-camera.rotation.y}rad)`;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  updateCamera();
  composer.render();
  
  // Update minimap
  if (moonObject) {
    minimapCamera.position.set(camera.position.x, 10000, camera.position.z);
    minimapRenderer.render(scene, minimapCamera);
  }
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// Start animation
animate();