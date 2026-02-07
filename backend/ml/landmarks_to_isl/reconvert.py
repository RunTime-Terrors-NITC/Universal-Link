"""
ISL Gesture Model Converter
This script converts your Keras model to TensorFlow.js format properly
"""

import tensorflow as tf
import tensorflowjs as tfjs
import numpy as np

# Load your original Keras model
# Replace 'your_model.h5' or 'your_model.keras' with your actual model file
model_path = 'isl_mlp_model.keras'  # or 'your_model.keras'

print("Loading Keras model...")
model = tf.keras.models.load_model(model_path)

print("\nModel Summary:")
model.summary()

print("\nInput shape:", model.input_shape)
print("Output shape:", model.output_shape)

# Convert to TensorFlow.js format
output_path = './tfjs_model'

print(f"\nConverting model to TensorFlow.js format...")
print(f"Output directory: {output_path}")

tfjs.converters.save_keras_model(model, output_path)

print("\n✅ Conversion complete!")
print(f"\nYour model has been saved to: {output_path}")
print("You'll find these files:")
print("  - model.json")
print("  - group1-shard1of1.bin (or similar)")
print("\nCopy these files to the same directory as your HTML file.")

# Test the model with dummy data
print("\n" + "="*50)
print("Testing model with dummy input...")
print("="*50)

dummy_input = np.random.rand(1, 127).astype(np.float32)
prediction = model.predict(dummy_input, verbose=0)
predicted_class = np.argmax(prediction[0])
predicted_letter = chr(65 + predicted_class)
confidence = prediction[0][predicted_class]

print(f"Dummy input shape: {dummy_input.shape}")
print(f"Prediction shape: {prediction.shape}")
print(f"Predicted class: {predicted_class}")
print(f"Predicted letter: {predicted_letter}")
print(f"Confidence: {confidence:.2%}")
print(f"All probabilities sum: {np.sum(prediction[0]):.4f}")