/*
 * Project: Intelligent Plant Health Monitoring Using Embedded AI
 * Team: Eyobel Zeleke, Abel Sisay, Helen Ayen, Hewan Solomon
 * Institution: Bahir Dar University, BIT – Computer Engineering
 * Date: 04/11/2025
 */

/* Includes ---------------------------------------------------------------- */
#include <Mango-Plant-Health-TinyML_inferencing.h>
#include <Arduino.h>
#include <cstring>

// Modular Libraries
#include "Config.h"
#include "Camera_OV7675.h"
#include "Image_Utils.h"

// Optional Hardware
#if ENABLE_OLED
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#endif

// ================= GLOBAL STATE =================
unsigned long lastScanTime = 0;

// Hardware Objects
static OV7675 Cam;

#if ENABLE_OLED
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
#endif

/* ----------- Storage for inference -------------*/
static const char *last_label = "N/A";
static float last_confidence = 0.0f;
static int last_dsp_ms = 0;
static int last_classification_ms = 0;

/* ----------- Static Memory Allocation (Crucial Fix) -------------*/
// Buffer for the resized image [160 x 120 x 2 bytes] approx 38KB
// Allocated statically to prevent heap fragmentation
#define IMAGE_BUFFER_SIZE (EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * 2) // RGB565
static uint8_t image_buffer[IMAGE_BUFFER_SIZE] __attribute__((aligned(4)));

// Global pointer for EI SDK (keep for compatibility)
static uint8_t *ei_camera_capture_out = NULL;
bool do_resize = false;
bool do_crop = false;

// ================= RECOMMENDATION SYSTEM =================
enum DiseaseType
{
    DISEASE_ANTHRACNOSE = 0,
    DISEASE_POWDERY_MILDEW,
    DISEASE_HEALTHY,
};

struct DiseaseAdvice
{
    const char *name;
    const char *action;
    const char *treatment;
};

const DiseaseAdvice diseaseDB[] PROGMEM = {
    {"Anthracnose", "Prune infected leaves", "Copper fungicide"},
    {"Powdery Mildew", "Remove infected shoots", "Sulfur / Neem oil"},
    {"Healthy", "No action needed", "Maintain care"},
};

// ================= FUNCTION DECLARATIONS =================
bool ei_camera_init(void);
void ei_camera_deinit(void);
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf);
void run_inference_once();
int ei_camera_cutout_get_data(size_t offset, size_t length, float *out_ptr);
DiseaseType classifyDisease(const char *label);
void printRecommendation(DiseaseType disease, float confidence);

// ================= SETUP =================
void setup()
{
    Serial.begin(115200);

#if DEMO_MODE
    while (!Serial)
    {
    } // Wait for USB
    Serial.println("Mango Health Monitoring (DEMO)");
#else
    delay(2000); // 2s stabilization
    Serial.println("Mango Health Monitoring (DEPLOYED)");
#endif

    ei_printf("Inferencing settings:\n");
    ei_printf("\tImage resolution: %dx%d\n", EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT);
    ei_printf("\tFrame size: %d\n", EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE);

#if ENABLE_BUZZER
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
#endif

#if ENABLE_OLED
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR))
    {
        ei_printf("OLED init failed\n");
    }
    else
    {
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(0, 0);
        display.println("Initializing...");
        display.display();
    }
#endif

    if (ei_camera_init())
    {
        ei_printf("Camera initialized successfully\n");
    }
    else
    {
        ei_printf("Camera Config Failed\n");
    }
}

// ================= LOOP =================
void loop()
{
    unsigned long now = millis();

#if DEMO_MODE
    static unsigned long lastDemoTime = 0;
    if (now - lastDemoTime >= DEMO_INTERVAL_MS)
    {
        lastDemoTime = now;
        run_inference_once();
    }
#else
    if (now - lastScanTime < SCAN_INTERVAL_MS)
    {
        // Optional: Low Power Sleep could be added here
        delay(10);
        return;
    }
    lastScanTime = now;
    run_inference_once();
#endif
}

// ================= INFERENCE LOGIC =================

void run_inference_once()
{
    ei_printf("Taking photo...\n");

    if (!ei_camera_init())
    {
        ei_printf("Camera failed to init\n");
        return;
    }

    // Capture using static buffer (No malloc here!)
    if (!ei_camera_capture(
            EI_CLASSIFIER_INPUT_WIDTH,
            EI_CLASSIFIER_INPUT_HEIGHT,
            image_buffer))
    {
        ei_printf("Failed to capture image\r\n");
        return;
    }

    ei::signal_t signal;
    signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
    signal.get_data = &ei_camera_cutout_get_data;

    // Run Classifier
    ei_impulse_result_t result = {0};
    EI_IMPULSE_ERROR ei_error = run_classifier(&signal, &result, false);

    if (ei_error != EI_IMPULSE_OK)
    {
        ei_printf("Failed to run impulse (%d)\n", ei_error);
        return;
    }

    // Process Results
    float best_score = -1.0f;
    float second_best_score = -1.0f;
    int best_idx = -1;

    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++)
    {
        float v = result.classification[i].value;
        if (v > best_score)
        {
            second_best_score = best_score;
            best_score = v;
            best_idx = i;
        }
        else if (v > second_best_score)
        {
            second_best_score = v;
        }
    }

    if (best_idx >= 0)
    {
        last_label = ei_classifier_inferencing_categories[best_idx];
        last_confidence = best_score;
    }

    bool confident = (best_score >= DISEASE_CONFIDENCE_THRESHOLD) &&
                     ((best_score - second_best_score) >= CONFIDENCE_MARGIN);

    // Simple Disease Detection (using strstr like original)
    bool isDisease = (strstr(last_label, "Anthracnose") != nullptr) ||
                     (strstr(last_label, "Powdery") != nullptr);

    ei_printf("Result: %s (%.2f%%)\n", last_label, last_confidence * 100.0);

    if (confident && isDisease)
    {
        ei_printf("[ALERT] Disease Detected!\n");
        DiseaseType disease = classifyDisease(last_label);
        printRecommendation(disease, last_confidence);

#if ENABLE_BUZZER
        tone(BUZZER_PIN, 2000, 3000); // 3s beep
#endif
    }
    else
    {
        ei_printf("Healthy or Low Confidence.\n");
    }
}

// ================= HELPERS =================

bool ei_camera_init(void)
{
    static bool is_initialised = false;
    if (is_initialised)
        return true;

    if (!Cam.begin(QQVGA, RGB565, 1))
    {
        return false;
    }
    is_initialised = true;
    return true;
}

bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf)
{
    // Determine resize/crop needs
    uint32_t resize_col_sz;
    uint32_t resize_row_sz;

    // Use Helper from Image_Utils
    int res = calculate_resize_dimensions(img_width, img_height, &resize_col_sz, &resize_row_sz, &do_resize);
    if (res)
        return false;

    if ((img_width != resize_col_sz) || (img_height != resize_row_sz))
    {
        do_crop = true;
    }

    // Set resize state in camera object
    Cam.resize_col_sz = resize_col_sz;
    Cam.resize_row_sz = resize_row_sz;

    // Capture (Class handles resize internally)
    Cam.readFrame(out_buf);

    // Handle Crop (if needed)
    if (do_crop)
    {
        uint32_t crop_col_start = (resize_col_sz - img_width) / 2;
        uint32_t crop_row_start = (resize_row_sz - img_height) / 2;

        cropImage(resize_col_sz, resize_row_sz,
                  out_buf,
                  crop_col_start, crop_row_start,
                  img_width, img_height,
                  out_buf,
                  16);
    }

    ei_camera_capture_out = out_buf;
    return true;
}

int ei_camera_cutout_get_data(size_t offset, size_t length, float *out_ptr)
{
    size_t pixel_ix = offset * 2;
    size_t bytes_left = length;
    size_t out_ptr_ix = 0;

    while (bytes_left != 0)
    {
        // RGB565 -> RGB888
        uint16_t pixel = (ei_camera_capture_out[pixel_ix] << 8) | ei_camera_capture_out[pixel_ix + 1];
        uint8_t r = ((pixel >> 11) & 0x1f) << 3;
        uint8_t g = ((pixel >> 5) & 0x3f) << 2;
        uint8_t b = (pixel & 0x1f) << 3;

        float pixel_f = (r << 16) + (g << 8) + b;
        out_ptr[out_ptr_ix] = pixel_f;

        out_ptr_ix++;
        pixel_ix += 2;
        bytes_left--;
    }
    return 0;
}

DiseaseType classifyDisease(const char *label)
{
    if (strstr(label, "Anthracnose") != nullptr)
        return DISEASE_ANTHRACNOSE;
    if (strstr(label, "Powdery") != nullptr)
        return DISEASE_POWDERY_MILDEW;
    // Default/Healthy
    return DISEASE_HEALTHY;
}

void printRecommendation(DiseaseType disease, float confidence)
{
    DiseaseAdvice advice;
    memcpy_P(&advice, &diseaseDB[disease], sizeof(DiseaseAdvice));

    Serial.println(" --- RECOMMENDATION --- ");
    Serial.print("Disease:   ");
    Serial.println(advice.name);
    Serial.print("Action:    ");
    Serial.println(advice.action);
    Serial.print("Treatment: ");
    Serial.println(advice.treatment);
    Serial.println(" ---------------------- ");
}
