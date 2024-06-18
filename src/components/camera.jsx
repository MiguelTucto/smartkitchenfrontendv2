import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { gsap } from 'gsap';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { FaCheckCircle, FaSpinner } from 'react-icons/fa';

const Camera = () => {
    const webcamRef = useRef(null);
    const [detections, setDetections] = useState([]);
    const [isDetectionActive, setIsDetectionActive] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [recipes, setRecipes] = useState([]); // Estado para las recetas
    const [currentRecipeIndex, setCurrentRecipeIndex] = useState(0); // Estado para la receta actual
    const [showPreparation, setShowPreparation] = useState(false); // Estado para mostrar la preparación
    const [loading, setLoading] = useState(false); // Estado para indicar carga
    const [loaded, setLoaded] = useState(false); // Estado para indicar que ha terminado de cargar
    const videoConstraints = {
        width: 640,
        height: 480,
        facingMode: "user"
    };

    const commands = [
        {
            command: 'Empieza la detección',
            callback: () => setIsDetectionActive(true)
        },
        {
            command: 'Detén la detección',
            callback: () => setIsDetectionActive(false)
        },
        {
            command: 'Abre el menú',
            callback: () => setIsMenuOpen(true)
        },
        {
            command: 'Cierra el menú',
            callback: () => setIsMenuOpen(false)
        },
        {
            command: 'Dame recetas',
            callback: () => fetchRecipes()
        }
    ];

    const { transcript, resetTranscript } = useSpeechRecognition({ commands });

    const capture = useCallback(() => {
        if (!isDetectionActive) return;

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
    }, [webcamRef, isDetectionActive]);

    const fetchRecipes = async () => {
        setLoading(true);
        setLoaded(false);
        const ingredients = detections.map(detection => detection.name).join(', ');
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that provides recipes in Spanish."
                    },
                    {
                        role: "user",
                        content: `Dame tres recetas usando los siguientes ingredientes: ${ingredients}. La respuesta debe ser clara y estructurada de la siguiente manera: 'Receta {número}: Ingredientes: ... Preparación: ...' sin otro texto adicional.`
                    }
                ],
                max_tokens: 300
            }, {
                headers: {
                    'Authorization': `Bearer sk-proj-84pMoEKyLGUUYiJowyMIT3BlbkFJxSKHli2e31THD9PdeTt7`,
                    'Content-Type': 'application/json'
                }
            });

            const recipesText = response.data.choices[0].message.content.trim();
            const recipesArray = recipesText.split(/Receta \d+:/).filter(recipe => recipe.trim() !== '');
            setRecipes(recipesArray.map(recipe => {
                const [ingredientsPart, preparationPart] = recipe.split('Preparación:');
                return {
                    title: `Receta ${recipesArray.indexOf(recipe) + 1}`,
                    ingredients: ingredientsPart.replace('Ingredientes:', '').trim(),
                    preparation: preparationPart?.trim() || ''
                };
            }));
            setLoading(false);
            setLoaded(true);
        } catch (error) {
            console.error("Error fetching recipes:", error);
            setRecipes([{ title: "Error", ingredients: "No se encontraron recetas o ocurrió un error.", preparation: "" }]);
            setLoading(false);
        }
    };

    const nextRecipe = () => {
        setCurrentRecipeIndex((currentRecipeIndex + 1) % recipes.length);
        setShowPreparation(false);
    };

    const previousRecipe = () => {
        setCurrentRecipeIndex((currentRecipeIndex - 1 + recipes.length) % recipes.length);
        setShowPreparation(false);
    };

    const togglePreparation = () => {
        setShowPreparation(!showPreparation);
    };

    useEffect(() => {
        const interval = setInterval(capture, 1000); // Captura cada 1 segundo
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
            svgContainer.setAttribute('style', `position: absolute; left: ${centerX - ringRadius}px; top: ${centerY - ringRadius}px; pointer-events: none; z-index: 2;`);

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
            textPath.setAttribute('style', `position: absolute; left: ${centerX - ringRadius}px; top: ${centerY - ringRadius - 5}px; z-index: 2;`);

            textPath.innerHTML = `
        <defs>
            <path id="textPath-${index}" d="M ${ringRadius},${ringRadius} m -${radius},0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 -${radius * 2},0" />
        </defs>
        <text fill="black" font-size="25" font-weight="bold">
            <textPath xlink:href="#textPath-${index}" startOffset="15%" text-anchor="middle">
                ${detection.name}
            </textPath>
        </text>
    `;
            document.querySelector('.camera-container').appendChild(textPath);

            // Información nutricional alrededor del círculo
            const nutritionInfo = [
                { label: 'Unidades', value: '2', angle: -70 },
                { label: 'Peso', value: '40g', angle: -30 },
                { label: 'Calorías', value: '160', angle: 10 }
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
                detectionInfo.style.padding = '15px';
                detectionInfo.style.fontSize = '20px';
                detectionInfo.style.fontStyle = 'italic';
                detectionInfo.style.fontWeight = 'bold';
                detectionInfo.style.borderRadius = '5px';
                detectionInfo.style.whiteSpace = 'nowrap';
                detectionInfo.style.zIndex = '2';
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

    useEffect(() => {
        if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
            console.error("Este navegador no soporta reconocimiento de voz.");
        } else {
            SpeechRecognition.startListening({ continuous: true });
        }
    }, []);



    return (
        <div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100vh' }} className="camera-container">
            <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                style={{ width: '100%', height: 'auto', position: 'absolute', zIndex: '1' }}
            />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'white', zIndex: '1', opacity: '0.1' }}></div>
            {isMenuOpen && (
                <div style={menuStyle}>
                    <h2 style={menuTitleStyle}>Menú</h2>
                    <ul style={detectionListStyle}>
                        {detections.map((detection, index) => (
                            <li key={index} style={detectionItemStyle}>
                                {detection.name}
                            </li>
                        ))}
                    </ul>
                    {loading && (
                        <div style={loadingStyle}>
                            <FaSpinner style={{ marginRight: '10px' }} />
                            Cargando...
                        </div>
                    )}
                    {loaded && !loading && (
                        <div style={loadingStyle}>
                            <FaCheckCircle style={{ marginRight: '10px' }} />
                            Carga completa
                        </div>
                    )}
                    {recipes.length > 0 && (
                        <div style={recipeContainerStyle}>
                            <h3 style={recipeTitleStyle}>{recipes[currentRecipeIndex].title}</h3>
                            <p><strong>Ingredientes:</strong> {recipes[currentRecipeIndex].ingredients}</p>
                            {showPreparation && (
                                <p><strong>Preparación:</strong> {recipes[currentRecipeIndex].preparation}</p>
                            )}
                            <button onClick={togglePreparation} style={buttonStyle}>
                                {showPreparation ? "Ocultar Preparación" : "Mostrar Preparación"}
                            </button>
                            <div style={buttonContainerStyle}>
                                <button onClick={previousRecipe} style={buttonStyle}>Anterior</button>
                                <button onClick={nextRecipe} style={buttonStyle}>Siguiente</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            <p style={transcriptStyle}>{transcript}</p>
        </div>
    );
};

const menuStyle = {
    position: 'absolute',
    top: '50px',
    right: '50px',
    width: '350px',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    padding: '20px',
    borderRadius: '10px',
    zIndex: '3',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    fontFamily: 'Arial, sans-serif'
};

const menuTitleStyle = {
    margin: '0 0 10px',
    fontSize: '24px',
    borderBottom: '2px solid white',
    paddingBottom: '5px'
};

const detectionListStyle = {
    listStyleType: 'none',
    padding: '0',
    margin: '0'
};

const detectionItemStyle = {
    marginBottom: '10px',
    fontSize: '18px',
    lineHeight: '1.5',
    border: '1px solid #4CAF50',
    borderRadius: '5px',
    padding: '5px 10px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
};

const recipeContainerStyle = {
    marginTop: '20px',
    fontSize: '16px',
    lineHeight: '1.5',
    border: '1px solid #4CAF50',
    borderRadius: '10px',
    padding: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
};

const recipeTitleStyle = {
    margin: '0 0 10px',
    fontSize: '20px',
    borderBottom: '1px solid white',
    paddingBottom: '5px'
};

const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '10px'
};

const buttonStyle = {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.3s',
};

buttonStyle[':hover'] = {
    backgroundColor: '#45a049'
};

const loadingStyle = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '16px',
    margin: '10px 0',
    color: 'yellow'
};

const transcriptStyle = {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    color: 'white',
    zIndex: '2'
};

export default Camera;
