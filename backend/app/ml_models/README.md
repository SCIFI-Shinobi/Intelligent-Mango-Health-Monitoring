Place the cloud EfficientNet model at:

`backend/app/ml_models/efficientnet_mango_leaf.h5`

Expected runtime contract:

- Format: Keras `.h5`
- Class order: `Anthracnose`, `Powdery Mildew`, `Healthy`
- Resize: uses the saved model's declared input shape at startup, with a fallback of `224x224x3`
- Color mode: RGB
- Normalization: divide pixel values by `255.0` to produce a `[0.0, 1.0]` range
- Compatibility: the backend includes a fallback loader for legacy Edge Impulse `.h5` exports that Keras 3 rejects during standard deserialization

If the file is missing, the API will stay up and the cloud scan endpoint will return a model-not-loaded error until the file is added.
