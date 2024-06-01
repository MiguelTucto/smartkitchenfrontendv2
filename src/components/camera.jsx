import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { gsap } from 'gsap';

const Camera = () => {
    const webcamRef = useRef(null);
    const [detections, setDetections] = useState([]);
    const videoConstraints = {
        width: 1280,
        height: 720,
        facingMode: "user"
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            axios.post('http://127.0.0.1:8000/api/detect/', { image: imageSrc.split(",")[1] })
                .then(response => {
                    console.log("API Response:", response.data);
                    setDetections(response.data);
                })
                .catch(error => {
                    console.error("There was an error detecting objects:", error);
                });
        }
    }, [webcamRef]);

    useEffect(() => {
        const interval = setInterval(capture, 1000);
        return () => clearInterval(interval);
    }, [capture]);

    useEffect(() => {
        const existingElements = document.querySelectorAll('.detection, .detection-info, .detection-name, .detection-ring');
        existingElements.forEach(element => element.remove());

        detections.forEach((detection, index) => {
            const { x1, y1, x2, y2 } = detection.coordinates;
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            const width = x2 - x1;
            const height = y2 - y1;
            const radius = Math.max(width, height) / 2;
            const ringRadius = radius + 20;

            // Crear un contenedor SVG para la detección
            const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgContainer.setAttribute('class', 'detection');
            svgContainer.setAttribute('width', `${ringRadius * 2}`);
            svgContainer.setAttribute('height', `${ringRadius * 2}`);
            svgContainer.setAttribute('style', `position: absolute; left: ${centerX - ringRadius}px; top: ${centerY - ringRadius}px; pointer-events: none;`);

            // Definir el clipPath para recortar el círculo interior
            svgContainer.innerHTML = `
                <defs>
                    <mask id="mask-${index}">
                        <rect x="0" y="0" width="${ringRadius * 2}" height="${ringRadius * 2}" fill="white"/>
                        <circle cx="${ringRadius}" cy="${ringRadius}" r="${radius}" fill="black" />
                    </mask>
                </defs>
                <circle cx="${ringRadius}" cy="${ringRadius}" r="${ringRadius}" fill="rgba(255, 165, 0, 0.5)" mask="url(#mask-${index})" />
            `;

            document.querySelector('.camera-container').appendChild(svgContainer);

            // Texto curvado alrededor del círculo
            const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            textPath.setAttribute('class', 'detection-name');
            textPath.setAttribute('width', `${ringRadius * 2}`);
            textPath.setAttribute('height', `${ringRadius * 2}`);
            textPath.setAttribute('style', `position: absolute; left: ${centerX - ringRadius}px; top: ${centerY - ringRadius - 5}px;`);

            textPath.innerHTML = `
                <defs>
                    <path id="textPath-${index}" d="M ${ringRadius},${ringRadius} m -${radius},0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 -${radius * 2},0" />
                </defs>
                <text fill="white" font-size="22" font-weight="bold">
                    <textPath xlink:href="#textPath-${index}" startOffset="25%" text-anchor="middle">
                        ${detection.name}
                    </textPath>
                </text>
            `;
            document.querySelector('.camera-container').appendChild(textPath);

            // Información nutricional alrededor del círculo
            const nutritionInfo = [
                { label: 'Unidades', value: '2', angle: -50 },
                { label: 'Peso', value: '40g', angle: -30 },
                { label: 'Calorías', value: '160', angle: -10 }
            ];

            nutritionInfo.forEach(info => {
                const angle = info.angle * (Math.PI / 180);
                const infoX = centerX + (radius + 80) * Math.cos(angle); // Aumenta la distancia aquí
                const infoY = centerY + (radius + 80) * Math.sin(angle); // Aumenta la distancia aquí

                const detectionInfo = document.createElement('div');
                detectionInfo.className = 'detection-info';
                detectionInfo.style.position = 'absolute';
                detectionInfo.style.left = `${infoX}px`;
                detectionInfo.style.top = `${infoY}px`;
                detectionInfo.style.transform = `translate(-50%, -50%)`;
                detectionInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                detectionInfo.style.color = 'white';
                detectionInfo.style.padding = '5px';
                detectionInfo.style.borderRadius = '5px';
                detectionInfo.style.whiteSpace = 'nowrap';
                detectionInfo.innerHTML = `
                    <strong>${info.value}</strong><br>
                    ${info.label}
                `;
                document.querySelector('.camera-container').appendChild(detectionInfo);
            });

            gsap.to(svgContainer, {
                x: 0,
                y: 0,
                duration: 0.5
            });
        });
    }, [detections]);

    return (
        <div style={{ position: 'relative', overflow: 'hidden', width: '100%', height:'1400px' }} className="camera-container">
            <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                style={{ width: '100%', height: 'auto', position: 'absolute' }}
            />
        </div>
    );
};

export default Camera;