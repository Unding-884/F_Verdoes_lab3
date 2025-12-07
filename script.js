import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

/**
 * Base
 */
const gui = new GUI();

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

// Loaders
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const hdrLoader = new HDRLoader();

/**
 * Textures
 */

hdrLoader.load('models/textures/hdr/goegap_1k.hdr', (hdrEquirect) => {
    hdrEquirect.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdrEquirect;
    scene.background = hdrEquirect;
});

// Floor
const floorAlphaTexture = textureLoader.load('models/textures/gravelly-sand/alpha.jpg')
const floorColorTexture = textureLoader.load('models/textures/gravelly-sand/gravelly_sand_diff_1k.jpg')
const floorAmbientOcclusionTexture = textureLoader.load('models/textures/gravelly-sand/gravelly_sand_disp_1k.png')
const floorNormalTexture = textureLoader.load('models/textures/gravelly-sand/gravelly_sand_nor_gl_1k.exr')
const floorRoughnessTexture = textureLoader.load('models/textures/gravelly-sand/gravelly_sand_rough_1k.exr')
floorColorTexture.repeat.set(4, 4)
floorAmbientOcclusionTexture.repeat.set(4, 4)
floorNormalTexture.repeat.set(4, 4)
floorRoughnessTexture.repeat.set(4, 4)
floorColorTexture.wrapS = THREE.RepeatWrapping
floorColorTexture.wrapT = THREE.RepeatWrapping
floorAmbientOcclusionTexture.wrapS = THREE.RepeatWrapping
floorAmbientOcclusionTexture.wrapT = THREE.RepeatWrapping
floorNormalTexture.wrapS = THREE.RepeatWrapping
floorNormalTexture.wrapT = THREE.RepeatWrapping
floorRoughnessTexture.wrapS = THREE.RepeatWrapping
floorRoughnessTexture.wrapT = THREE.RepeatWrapping

// Models
gltfLoader.load(
    '/models/scene.gltf',
    (gltf) => {
        console.log('success');
        scene.add(gltf.scene);
        gltf.scene.position.set(0, 1.6, 0);
        gltf.scene.scale.set(5, 5, 5);

        gltf.scene.traverse((child) => {
            child.castShadow = true;
        });
    }
);

// Rocks
gltfLoader.load(
    '/rocks/namaqualand_stones_01_1k.gltf',
    (gltf) => {
        const rockModel = gltf.scene;

        for (let i = 0; i < 23; i++) {
            const rock = rockModel.clone();

            const angle = Math.random() * Math.PI * 2;
            const radius = 4 + Math.random() * 7;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            rock.position.set(x, 0, z);

            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.rotation.x = (Math.random() - 0.5) * 0.05;
            rock.rotation.z = (Math.random() - 0.5) * 0.05;

            const scale = 0.5 + Math.random() * 3;
            rock.scale.set(scale, scale, scale);

            rock.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(rock);
        }
    }
);

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({
        alphaMap: floorAlphaTexture,
        transparent: true,
        map: floorColorTexture
    })
)
floor.rotation.x = - Math.PI * 0.5
floor.receiveShadow = true;
scene.add(floor)

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4, 0, 4);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.target.y = 3.5;
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/**
 * Particles
 */
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 5000;
const posArray = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 40;
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.02,
    color: 0xd4a574,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

/**
 * Heat Haze Effect
 */
const heatHazeVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const heatHazeFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    
    void main() {
        vec2 uv = vUv;
        
        // Only show at edges
        float edgeFade = smoothstep(0.3, 0.0, abs(uv.x - 0.5)) * smoothstep(0.3, 0.0, abs(uv.y - 0.5));
        
        // Create subtle heat distortion waves
        float wave1 = sin(uv.y * 15.0 + uTime * 2.5) * 0.5;
        float wave2 = sin(uv.y * 25.0 - uTime * 3.5) * 0.3;
        
        // Very subtle shimmer with slight warm tint
        float alpha = (0.1 + sin(uv.y * 20.0 + uTime * 4.0) * 0.5) * edgeFade;
        vec3 heatColor = vec3(1.0, 0.95, 0.85);
        
        gl_FragColor = vec4(heatColor, alpha);
    }
`;

const heatHazeMaterial = new THREE.ShaderMaterial({
    vertexShader: heatHazeVertexShader,
    fragmentShader: heatHazeFragmentShader,
    uniforms: {
        uTime: { value: 0 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
});

const heatHazeGeometry = new THREE.PlaneGeometry(35, 6);

// Create 4 heat haze planes at the edges
const heatHazePositions = [
    { x: 10, z: 0, rotation: Math.PI / 2 },  // Right
    { x: -10, z: 0, rotation: -Math.PI / 2 }, // Left
    { x: 0, z: 10, rotation: 0 },            // Front
    { x: 0, z: -10, rotation: Math.PI }      // Back
];

heatHazePositions.forEach(pos => {
    const heatHazeMesh = new THREE.Mesh(heatHazeGeometry, heatHazeMaterial);
    heatHazeMesh.position.set(pos.x, 2, pos.z);
    heatHazeMesh.rotation.y = pos.rotation;
    scene.add(heatHazeMesh);
});


/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(10, 8, 8.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

/**
 * Fog
 */
scene.fog = new THREE.FogExp2('#cbd69bff', 0.08)

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
    const elapsedTime = clock.getElapsedTime();

    // Update heat haze shader
    heatHazeMaterial.uniforms.uTime.value = elapsedTime;

    particlesMesh.rotation.y = elapsedTime * 0.02;
    particlesMesh.position.y = Math.sin(elapsedTime * 0.3) * 0.2;

    controls.update();

    renderer.render(scene, camera);

    window.requestAnimationFrame(tick);
};

tick();

/**
 * window resize
 */
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});