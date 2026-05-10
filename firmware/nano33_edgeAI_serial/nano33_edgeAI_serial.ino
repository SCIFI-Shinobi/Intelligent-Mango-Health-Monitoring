/* Edge Impulse ingestion SDK
 * Copyright (c) 2022 EdgeImpulse Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Includes ---------------------------------------------------------------- */
#include <mango_health_inferencing.h>
#include <Arduino_OV767X.h>
#include <DHT.h>
#include <Wire.h>

#include <stdint.h>
#include <stdlib.h>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include <cmath>
#include <algorithm>

// ======================================================
//  RECOMMENDATION ENGINE
// ======================================================

enum class DiseaseType {
    ANTHRACNOSE,
    POWDERY_MILDEW,
    HEALTHY
};

enum class RiskLevel {
    LOW,
    MEDIUM,
    HIGH
};

struct EnvironmentalData {
    float temperature_c;
    float humidity_percent;
    float rainfall_mm;
};

struct DiseaseProfile {
    const char* full_name;
    float temp_min;
    float temp_max;
    float temp_optimal;
    float humidity_min;
    float humidity_max;
    float humidity_optimal;
    float rainfall_threshold;
    bool  high_humidity_suppresses;
};

struct EnvironmentalAssessment {
    float       temp_score;
    float       humidity_score;
    float       combined_score;
    bool        temp_in_window;
    bool        humidity_in_window;
    bool        conditions_suppressive;
    RiskLevel   risk_level;
};

struct RecommendationOutput {
    DiseaseType              disease;
    RiskLevel                risk_level;
    std::string              category_en;
    std::string              category_am;
};

static const DiseaseProfile ANTHRACNOSE_PROFILE = {
    "Anthracnose",
    20.0f, 35.0f, 28.0f,
    80.0f, 100.0f, 95.0f,
    5.0f,
    false
};

static const DiseaseProfile POWDERY_MILDEW_PROFILE = {
    "Powdery Mildew",
    10.0f, 33.0f, 22.0f,
    50.0f, 80.0f, 62.0f,
    0.0f,
    true
};

class RecommendationEngine {
public:
    const DiseaseProfile* loadProfile(DiseaseType disease) const {
        switch (disease) {
            case DiseaseType::ANTHRACNOSE:    return &ANTHRACNOSE_PROFILE;
            case DiseaseType::POWDERY_MILDEW: return &POWDERY_MILDEW_PROFILE;
            default:                          return nullptr;
        }
    }

    float scoreTemperature(float temp, const DiseaseProfile& p) const {
        if (temp < p.temp_min || temp > p.temp_max) {
            return 0.0f;
        }
        float half_range = (temp <= p.temp_optimal)
                         ? (p.temp_optimal - p.temp_min)
                         : (p.temp_max - p.temp_optimal);
        float distance = std::fabs(temp - p.temp_optimal);
        float score    = 1.0f - 0.5f * (distance / half_range);
        return std::max(0.0f, std::min(1.0f, score));
    }

    float scoreHumidity(float humidity, float rainfall, const DiseaseProfile& p) const {
        float score = 0.0f;

        if (p.high_humidity_suppresses) {
            if (humidity > p.humidity_max || rainfall > 2.0f) {
                return 0.0f;
            }
            if (humidity < p.humidity_min) {
                return 0.0f;
            }
            float half_range = (humidity <= p.humidity_optimal)
                             ? (p.humidity_optimal - p.humidity_min)
                             : (p.humidity_max - p.humidity_optimal);
            float distance = std::fabs(humidity - p.humidity_optimal);
            score = 1.0f - 0.5f * (distance / half_range);
            return std::max(0.0f, std::min(1.0f, score));
        } else {
            if (humidity < p.humidity_min) {
                return 0.0f;
            }
            float range = p.humidity_max - p.humidity_min;
            score = 0.5f + 0.5f * ((humidity - p.humidity_min) / range);
            score = std::max(0.0f, std::min(1.0f, score));

            if (rainfall >= p.rainfall_threshold) {
                score = std::min(1.0f, score + 0.15f);
            }
            return score;
        }
    }

    EnvironmentalAssessment assessEnvironment(
            const EnvironmentalData& env,
            const DiseaseProfile* profile) const {

        EnvironmentalAssessment result;

        if (profile == nullptr) {
            result.temp_score     = 0.0f;
            result.humidity_score = 0.0f;
            result.combined_score = 0.0f;
            result.temp_in_window     = false;
            result.humidity_in_window = false;
            result.conditions_suppressive = true;
            result.risk_level         = RiskLevel::LOW;
            return result;
        }

        result.temp_score = scoreTemperature(env.temperature_c, *profile);
        result.humidity_score = scoreHumidity(env.humidity_percent, env.rainfall_mm, *profile);

        result.temp_in_window     = (result.temp_score     > 0.0f);
        result.humidity_in_window = (result.humidity_score > 0.0f);
        result.combined_score     = 0.50f * result.temp_score
                                  + 0.50f * result.humidity_score;

        if (result.combined_score >= 0.70f)
            result.risk_level = RiskLevel::HIGH;
        else if (result.combined_score >= 0.40f)
            result.risk_level = RiskLevel::MEDIUM;
        else
            result.risk_level = RiskLevel::LOW;

        result.conditions_suppressive =
            (!result.temp_in_window && !result.humidity_in_window);

        return result;
    }

    RecommendationOutput generateRecommendation(
            DiseaseType disease,
            const EnvironmentalAssessment& env) const {

        RecommendationOutput out;
        out.disease        = disease;
        out.risk_level     = env.risk_level;

        if (disease == DiseaseType::ANTHRACNOSE) {
            switch (env.risk_level) {
            case RiskLevel::LOW:
                out.category_en = "Monitor & clear fallen leaves";
                out.category_am = "ተቆጣጠር እና የረገፉ ቅጠሎችን አጽዳ";
                break;
            case RiskLevel::MEDIUM:
                out.category_en = "Apply copper-based fungicide";
                out.category_am = "በመዳብ የተሰራ ጸረ-ፈንገስ ርጭት አድርግ";
                break;
            case RiskLevel::HIGH:
                out.category_en = "URGENT: Prune & apply systemic fungicide";
                out.category_am = "አስቸኳይ: ቅርንጫፎችን ቁረጥ እና ጸረ-ፈንገስ ርጭት አድርግ";
                break;
            }
        } else if (disease == DiseaseType::POWDERY_MILDEW) {
            switch (env.risk_level) {
            case RiskLevel::LOW:
                out.category_en = "Ensure good airflow & reduce shade";
                out.category_am = "ጥሩ አየር እንዲገባ አድርግ እና ጥላን ቀንስ";
                break;
            case RiskLevel::MEDIUM:
                out.category_en = "Apply sulfur or neem oil spray";
                out.category_am = "የዲን ወይም የኒም ዘይት ርጭት አድርግ";
                break;
            case RiskLevel::HIGH:
                out.category_en = "URGENT: Use potassium bicarbonate & prune";
                out.category_am = "አስቸኳይ: ፖታሲየም ባይካርቦኔት ተጠቀም እና ቁረጥ";
                break;
            }
        } else {
            out.category_en = "Your Trees Look Healthy";
            out.category_am = "ዛፎችዎ ጤናማ ናቸው";
        }
        return out;
    }

    RecommendationOutput run(DiseaseType disease, const EnvironmentalData& env) const {
        const DiseaseProfile* profile = loadProfile(disease);
        EnvironmentalAssessment env_assessment = assessEnvironment(env, profile);
        return generateRecommendation(disease, env_assessment);
    }
};

static std::string riskToStr(RiskLevel r) {
    switch (r) {
        case RiskLevel::LOW:    return "LOW";
        case RiskLevel::MEDIUM: return "MEDIUM";
        case RiskLevel::HIGH:   return "HIGH";
        default:                return "UNKNOWN";
    }
}

/* Constant variables ------------------------------------------------------- */
#define EI_CAMERA_RAW_FRAME_BUFFER_COLS     160
#define EI_CAMERA_RAW_FRAME_BUFFER_ROWS     120

#define DWORD_ALIGN_PTR(a)   ((a & 0x3) ?(((uintptr_t)a + 0x4) & ~(uintptr_t)0x3) : a)

#define DHTPIN        12
#define DHTTYPE       DHT22
#define BUZZER_PIN    11
#define LED_RED_PIN   A6

/* Auto-Scan Configuration ------------------------------------------------- */
static unsigned long lastScanTime = 0;
const unsigned long scanIntervalMs = 20000; // 20 seconds

/* Peripheral objects ------------------------------------------------------ */
DHT               dht(DHTPIN, DHTTYPE);

/* Edge Impulse ------------------------------------------------------------- */
class OV7675 : public OV767X {
    public:
        int begin(int resolution, int format, int fps);
        void readFrame(void* buffer);

    private:
        int vsyncPin;
        int hrefPin;
        int pclkPin;
        int xclkPin;

        volatile uint32_t* vsyncPort;
        uint32_t vsyncMask;
        volatile uint32_t* hrefPort;
        uint32_t hrefMask;
        volatile uint32_t* pclkPort;
        uint32_t pclkMask;

        uint16_t width;
        uint16_t height;
        uint8_t bytes_per_pixel;
        uint16_t bytes_per_row;
        uint8_t buf_rows;
        uint16_t buf_size;
        uint8_t resize_height;
        uint8_t *raw_buf;
        void *buf_mem;
        uint8_t *intrp_buf;
        uint8_t *buf_limit;

        void readBuf();
        int allocate_scratch_buffs();
        int deallocate_scratch_buffs();
};

typedef struct {
	size_t width;
	size_t height;
} ei_device_resize_resolutions_t;

int ei_get_serial_available(void) {
    return Serial.available();
}

char ei_get_serial_byte(void) {
    return Serial.read();
}

/* Private variables ------------------------------------------------------- */
static OV7675 Cam;
static bool is_initialised = false;

static uint8_t *ei_camera_capture_out = NULL;
uint32_t resize_col_sz;
uint32_t resize_row_sz;
bool do_resize = false;
bool do_crop = false;

static bool debug_nn = false;

/* Function definitions ------------------------------------------------------- */
bool ei_camera_init(void);
void ei_camera_deinit(void);
bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf);
int calculate_resize_dimensions(uint32_t out_width, uint32_t out_height, uint32_t *resize_col_sz, uint32_t *resize_row_sz, bool *do_resize);
void resizeImage(int srcWidth, int srcHeight, uint8_t *srcImage, int dstWidth, int dstHeight, uint8_t *dstImage, int iBpp);
void cropImage(int srcWidth, int srcHeight, uint8_t *srcImage, int startX, int startY, int dstWidth, int dstHeight, uint8_t *dstImage, int iBpp);

void serial_send_scan(const char *label, float confidence, float temp, float hum, const char* cat_en, const char* cat_am);
void run_automated_scan(void);

/**
* @brief      Arduino setup function
*/
void setup()
{
    Serial.begin(115200);
    // while (!Serial); // Removed so it doesn't block headless operation
    Serial.println("MangoGuard Edge Impulse Demo");

    ei_printf("Inferencing settings:\n");
    ei_printf("\tImage resolution: %dx%d\n", EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT);
    ei_printf("\tFrame size: %d\n", EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE);
    ei_printf("\tNo. of classes: %d\n", sizeof(ei_classifier_inferencing_categories) / sizeof(ei_classifier_inferencing_categories[0]));

    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
    pinMode(LED_RED_PIN, OUTPUT);
    digitalWrite(LED_RED_PIN, LOW);

    dht.begin();
    Wire.begin();

    unsigned long startWait = millis();
    while (!Serial && millis() - startWait < 3000) {
        delay(10);
    }

    if (Serial) {
        Serial.println("Pi Connected!");
    } else {
        Serial.println("Offline Mode");
    }

    Serial.println("Serial USB ready. Auto-scanning every 10 seconds or send 'scan' command.");
}

/**
* @brief      Main loop
*/
void loop()
{
    // ── Remote "scan" command from Raspberry Pi ──────────────────────────────
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toLowerCase();
        if (cmd == "scan") {
            run_automated_scan();
        }
    }

    // ── Periodic Auto-Scan (every 10 seconds) ────────────────────────────────
    if (millis() - lastScanTime >= scanIntervalMs) {
        lastScanTime = millis();
        run_automated_scan();
    }

    delay(10);
}

void run_automated_scan(void) {
    ei_printf("\n--- Starting Health Scan ---\n");

    if (ei_camera_init() == false) {
        ei_printf("ERR: Failed to initialize image sensor\r\n");
        return;
    }

    uint32_t resize_col_sz;
    uint32_t resize_row_sz;
    bool do_resize = false;
    int res = calculate_resize_dimensions(EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT, &resize_col_sz, &resize_row_sz, &do_resize);
    if (res) {
        ei_printf("ERR: Failed to calculate resize dimensions (%d)\r\n", res);
        ei_camera_deinit();
        return;
    }

    void *snapshot_mem = NULL;
    uint8_t *snapshot_buf = NULL;
    snapshot_mem = ei_malloc(resize_col_sz*resize_row_sz*2);
    if(snapshot_mem == NULL) {
        ei_printf("failed to create snapshot_mem\r\n");
        ei_camera_deinit();
        return;
    }
    snapshot_buf = (uint8_t *)DWORD_ALIGN_PTR((uintptr_t)snapshot_mem);

    if (ei_camera_capture(EI_CLASSIFIER_INPUT_WIDTH, EI_CLASSIFIER_INPUT_HEIGHT, snapshot_buf) == false) {
        ei_printf("Failed to capture image\r\n");
        if (snapshot_mem) ei_free(snapshot_mem);
        ei_camera_deinit();
        return;
    }

    ei::signal_t signal;
    signal.total_length = EI_CLASSIFIER_INPUT_WIDTH * EI_CLASSIFIER_INPUT_HEIGHT;
    signal.get_data = &ei_camera_cutout_get_data;

    ei_impulse_result_t result = { 0 };

    EI_IMPULSE_ERROR ei_error = run_classifier(&signal, &result, debug_nn);
    if (ei_error != EI_IMPULSE_OK) {
        ei_printf("Failed to run impulse (%d)\n", ei_error);
        if (snapshot_mem) ei_free(snapshot_mem);
        ei_camera_deinit();
        return;
    }

    if (snapshot_mem) ei_free(snapshot_mem);
    ei_camera_deinit();

    // Find highest confidence prediction
    float best_confidence = 0.0f;
    const char* best_label = "Unknown";

    for (uint16_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        if (result.classification[i].value > best_confidence) {
            best_confidence = result.classification[i].value;
            best_label = ei_classifier_inferencing_categories[i];
        }
    }

    ei_printf("Result: %s (%.2f%%)\n", best_label, best_confidence * 100.0f);

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    if (isnan(temp)) temp = 25.0f;
    if (isnan(hum))  hum  = 70.0f;

    DiseaseType dType = DiseaseType::HEALTHY;
    if (strcmp(best_label, "Anthracnose") == 0) dType = DiseaseType::ANTHRACNOSE;
    else if (strcmp(best_label, "Powdery Mildew") == 0) dType = DiseaseType::POWDERY_MILDEW;

    RecommendationEngine engine;
    EnvironmentalData env = { temp, hum, 0.0f }; // 0.0f rainfall
    RecommendationOutput out = engine.run(dType, env);

    // Send result over Serial USB to Raspberry Pi
    serial_send_scan(best_label, best_confidence, temp, hum, out.category_en.c_str(), out.category_am.c_str());

    // Always reset LED first, then set final state based on this scan's result
    digitalWrite(LED_RED_PIN, LOW);

    if (dType != DiseaseType::HEALTHY && best_confidence >= 0.70f) {
        digitalWrite(LED_RED_PIN, HIGH); // Diseased & high confidence — LED ON
        for (int i = 0; i < 3; i++) {
            digitalWrite(BUZZER_PIN, HIGH); delay(500);
            digitalWrite(BUZZER_PIN, LOW);  delay(300);
        }
        digitalWrite(BUZZER_PIN, LOW); // Ensure buzzer is off after sequence
    } else if (dType == DiseaseType::HEALTHY) {
        // Single short confirmation beep for healthy scan
        digitalWrite(BUZZER_PIN, HIGH); delay(150);
        digitalWrite(BUZZER_PIN, LOW);
    }
    // Low-confidence disease: LED stays off, no beep (ambiguous result)
}

/* =========================================================================
 *  Serial output helper
 * ========================================================================= */
void serial_send_scan(const char *label, float confidence, float temp, float hum, const char* cat_en, const char* cat_am) {
    char payload[256];
    snprintf(payload, sizeof(payload), "SCAN:%s,%.5f,%.1f,%.1f,%s,%s", label, confidence, temp, hum, cat_en, cat_am);
    Serial.println(payload);
    ei_printf("Serial sent: %s\r\n", payload);
}

/* =========================================================================
 *  Camera helpers (unchanged from original)
 * ========================================================================= */
int calculate_resize_dimensions(uint32_t out_width, uint32_t out_height, uint32_t *resize_col_sz, uint32_t *resize_row_sz, bool *do_resize)
{
    size_t list_size = 2;
    const ei_device_resize_resolutions_t list[list_size] = { {42,32}, {128,96} };

    *resize_col_sz = EI_CAMERA_RAW_FRAME_BUFFER_COLS;
    *resize_row_sz = EI_CAMERA_RAW_FRAME_BUFFER_ROWS;
    *do_resize = false;

    for (size_t ix = 0; ix < list_size; ix++) {
        if ((out_width <= list[ix].width) && (out_height <= list[ix].height)) {
            *resize_col_sz = list[ix].width;
            *resize_row_sz = list[ix].height;
            *do_resize = true;
            break;
        }
    }

    return 0;
}

bool ei_camera_init(void) {
    if (is_initialised) return true;

    if (!Cam.begin(QQVGA, RGB565, 1)) {
        ei_printf("ERR: Failed to initialize camera\r\n");
        return false;
    }
    is_initialised = true;
    return true;
}

void ei_camera_deinit(void) {
    if (is_initialised) {
        Cam.end();
        is_initialised = false;
    }
}

bool ei_camera_capture(uint32_t img_width, uint32_t img_height, uint8_t *out_buf)
{
    if (!is_initialised) {
        ei_printf("ERR: Camera is not initialized\r\n");
        return false;
    }

    if (!out_buf) {
        ei_printf("ERR: invalid parameters\r\n");
        return false;
    }

    int res = calculate_resize_dimensions(img_width, img_height, &resize_col_sz, &resize_row_sz, &do_resize);
    if (res) {
        ei_printf("ERR: Failed to calculate resize dimensions (%d)\r\n", res);
        return false;
    }

    if ((img_width != resize_col_sz) || (img_height != resize_row_sz)) {
        do_crop = true;
    }

    Cam.readFrame(out_buf);

    if (do_crop) {
        uint32_t crop_col_sz;
        uint32_t crop_row_sz;
        uint32_t crop_col_start;
        uint32_t crop_row_start;
        crop_row_start = (resize_row_sz - img_height) / 2;
        crop_col_start = (resize_col_sz - img_width) / 2;
        crop_col_sz = img_width;
        crop_row_sz = img_height;

        cropImage(resize_col_sz, resize_row_sz,
                out_buf,
                crop_col_start, crop_row_start,
                crop_col_sz, crop_row_sz,
                out_buf,
                16);
    }

    ei_camera_capture_out = out_buf;
    return true;
}

int ei_camera_cutout_get_data(size_t offset, size_t length, float *out_ptr) {
    size_t pixel_ix = offset * 2;
    size_t bytes_left = length;
    size_t out_ptr_ix = 0;

    while (bytes_left != 0) {
        uint16_t pixel = (ei_camera_capture_out[pixel_ix] << 8) | ei_camera_capture_out[pixel_ix+1];
        uint8_t r, g, b;
        r = ((pixel >> 11) & 0x1f) << 3;
        g = ((pixel >> 5) & 0x3f) << 2;
        b = (pixel & 0x1f) << 3;

        float pixel_f = (r << 16) + (g << 8) + b;
        out_ptr[out_ptr_ix] = pixel_f;

        out_ptr_ix++;
        pixel_ix+=2;
        bytes_left--;
    }
    return 0;
}

#ifdef __ARM_FEATURE_SIMD32
#include <device.h>
#endif
#define FRAC_BITS 14
#define FRAC_VAL (1<<FRAC_BITS)
#define FRAC_MASK (FRAC_VAL - 1)

void resizeImage(int srcWidth, int srcHeight, uint8_t *srcImage, int dstWidth, int dstHeight, uint8_t *dstImage, int iBpp)
{
    uint32_t src_x_accum, src_y_accum;
    uint32_t x_frac, nx_frac, y_frac, ny_frac;
    int x, y, ty, tx;

    if (iBpp != 8 && iBpp != 16)
        return;
    src_y_accum = FRAC_VAL/2;
    const uint32_t src_x_frac = (srcWidth * FRAC_VAL) / dstWidth;
    const uint32_t src_y_frac = (srcHeight * FRAC_VAL) / dstHeight;
    const uint32_t r_mask = 0xf800f800;
    const uint32_t g_mask = 0x07e007e0;
    const uint32_t b_mask = 0x001f001f;
    uint8_t *s, *d;
    uint16_t *s16, *d16;
    uint32_t x_frac2, y_frac2;
    for (y=0; y < dstHeight; y++) {
        ty = src_y_accum >> FRAC_BITS;
        y_frac = src_y_accum & FRAC_MASK;
        src_y_accum += src_y_frac;
        ny_frac = FRAC_VAL - y_frac;
        y_frac2 = ny_frac | (y_frac << 16);
        s = &srcImage[ty * srcWidth];
        s16 = (uint16_t *)&srcImage[ty * srcWidth * 2];
        d = &dstImage[y * dstWidth];
        d16 = (uint16_t *)&dstImage[y * dstWidth * 2];
        src_x_accum = FRAC_VAL/2;
        if (iBpp == 8) {
        for (x=0; x < dstWidth; x++) {
            uint32_t tx, p00,p01,p10,p11;
            tx = src_x_accum >> FRAC_BITS;
            x_frac = src_x_accum & FRAC_MASK;
            nx_frac = FRAC_VAL - x_frac;
            x_frac2 = nx_frac | (x_frac << 16);
            src_x_accum += src_x_frac;
            p00 = s[tx]; p10 = s[tx+1];
            p01 = s[tx+srcWidth]; p11 = s[tx+srcWidth+1];
    #ifdef __ARM_FEATURE_SIMD32
            p00 = __SMLAD(p00 | (p10<<16), x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            p01 = __SMLAD(p01 | (p11<<16), x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            p00 = __SMLAD(p00 | (p01<<16), y_frac2, FRAC_VAL/2) >> FRAC_BITS;
    #else
            p00 = ((p00 * nx_frac) + (p10 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            p01 = ((p01 * nx_frac) + (p11 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            p00 = ((p00 * ny_frac) + (p01 * y_frac) + FRAC_VAL/2) >> FRAC_BITS;
    #endif
            *d++ = (uint8_t)p00;
        }
        } else {
        for (x=0; x < dstWidth; x++) {
            uint32_t tx, p00,p01,p10,p11;
            uint32_t r00, r01, r10, r11, g00, g01, g10, g11, b00, b01, b10, b11;
            tx = src_x_accum >> FRAC_BITS;
            x_frac = src_x_accum & FRAC_MASK;
            nx_frac = FRAC_VAL - x_frac;
            x_frac2 = nx_frac | (x_frac << 16);
            src_x_accum += src_x_frac;
            p00 = __builtin_bswap16(s16[tx]); p10 = __builtin_bswap16(s16[tx+1]);
            p01 = __builtin_bswap16(s16[tx+srcWidth]); p11 = __builtin_bswap16(s16[tx+srcWidth+1]);
    #ifdef __ARM_FEATURE_SIMD32
            {
            p00 |= (p10 << 16); p01 |= (p11 << 16);
            r00 = (p00 & r_mask) >> 1; g00 = p00 & g_mask; b00 = p00 & b_mask;
            r01 = (p01 & r_mask) >> 1; g01 = p01 & g_mask; b01 = p01 & b_mask;
            r00 = __SMLAD(r00, x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            r01 = __SMLAD(r01, x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            r00 = __SMLAD(r00 | (r01<<16), y_frac2, FRAC_VAL/2) >> FRAC_BITS;
            g00 = __SMLAD(g00, x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            g01 = __SMLAD(g01, x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            g00 = __SMLAD(g00 | (g01<<16), y_frac2, FRAC_VAL/2) >> FRAC_BITS;
            b00 = __SMLAD(b00, x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            b01 = __SMLAD(b01, x_frac2, FRAC_VAL/2) >> FRAC_BITS;
            b00 = __SMLAD(b00 | (b01<<16), y_frac2, FRAC_VAL/2) >> FRAC_BITS;
            }
    #else
            {
            r00 = (p00 & r_mask) >> 1; g00 = p00 & g_mask; b00 = p00 & b_mask;
            r10 = (p10 & r_mask) >> 1; g10 = p10 & g_mask; b10 = p10 & b_mask;
            r01 = (p01 & r_mask) >> 1; g01 = p01 & g_mask; b01 = p01 & b_mask;
            r11 = (p11 & r_mask) >> 1; g11 = p11 & g_mask; b11 = p11 & b_mask;
            r00 = ((r00 * nx_frac) + (r10 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            r01 = ((r01 * nx_frac) + (r11 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            r00 = ((r00 * ny_frac) + (r01 * y_frac) + FRAC_VAL/2) >> FRAC_BITS;
            g00 = ((g00 * nx_frac) + (g10 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            g01 = ((g01 * nx_frac) + (g11 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            g00 = ((g00 * ny_frac) + (g01 * y_frac) + FRAC_VAL/2) >> FRAC_BITS;
            b00 = ((b00 * nx_frac) + (b10 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            b01 = ((b01 * nx_frac) + (b11 * x_frac) + FRAC_VAL/2) >> FRAC_BITS;
            b00 = ((b00 * ny_frac) + (b01 * y_frac) + FRAC_VAL/2) >> FRAC_BITS;
            }
    #endif
            r00 = (r00 << 1) & r_mask;
            g00 = g00 & g_mask;
            b00 = b00 & b_mask;
            p00 = (r00 | g00 | b00);
            *d16++ = (uint16_t)__builtin_bswap16(p00);
        }
        }
    }
}

void cropImage(int srcWidth, int srcHeight, uint8_t *srcImage, int startX, int startY, int dstWidth, int dstHeight, uint8_t *dstImage, int iBpp)
{
    uint32_t *s32, *d32;
    int x, y;

    if (startX < 0 || startX >= srcWidth || startY < 0 || startY >= srcHeight ||
        (startX + dstWidth) > srcWidth || (startY + dstHeight) > srcHeight)
       return;
    if (iBpp != 8 && iBpp != 16)
       return;

    if (iBpp == 8) {
      uint8_t *s, *d;
      for (y=0; y<dstHeight; y++) {
        s = &srcImage[srcWidth * (y + startY) + startX];
        d = &dstImage[(dstWidth * y)];
        x = 0;
        if ((intptr_t)s & 3 || (intptr_t)d & 3) {
          for (; x<dstWidth; x++) { *d++ = *s++; }
        } else {
          s32 = (uint32_t *)s; d32 = (uint32_t *)d;
          for (; x<dstWidth-3; x+= 4) { *d32++ = *s32++; }
          s = (uint8_t *)s32; d = (uint8_t *)d32;
          for (; x<dstWidth; x++) { *d++ = *s++; }
        }
      }
    } else {
      uint16_t *s, *d;
      for (y=0; y<dstHeight; y++) {
        s = (uint16_t *)&srcImage[2 * srcWidth * (y + startY) + startX * 2];
        d = (uint16_t *)&dstImage[(dstWidth * y * 2)];
        x = 0;
        if ((intptr_t)s & 2 || (intptr_t)d & 2) {
          for (; x<dstWidth; x++) { *d++ = *s++; }
        } else {
          s32 = (uint32_t *)s; d32 = (uint32_t *)d;
          for (; x<dstWidth-1; x+= 2) { *d32++ = *s32++; }
          s = (uint16_t *)s32; d = (uint16_t *)d32;
          for (; x<dstWidth; x++) { *d++ = *s++; }
        }
      }
    }
}

#if !defined(EI_CLASSIFIER_SENSOR) || EI_CLASSIFIER_SENSOR != EI_CLASSIFIER_SENSOR_CAMERA
#error "Invalid model for current sensor"
#endif

#include <Arduino.h>
#include <Wire.h>

#define digitalPinToBitMask(P) (1 << (digitalPinToPinName(P) % 32))
#define portInputRegister(P) ((P == 0) ? &NRF_P0->IN : &NRF_P1->IN)

int OV7675::begin(int resolution, int format, int fps)
{
    pinMode(OV7670_VSYNC, INPUT);
    pinMode(OV7670_HREF, INPUT);
    pinMode(OV7670_PLK, INPUT);
    pinMode(OV7670_XCLK, OUTPUT);

    vsyncPort = portInputRegister(digitalPinToPort(OV7670_VSYNC));
    vsyncMask = digitalPinToBitMask(OV7670_VSYNC);
    hrefPort = portInputRegister(digitalPinToPort(OV7670_HREF));
    hrefMask = digitalPinToBitMask(OV7670_HREF);
    pclkPort = portInputRegister(digitalPinToPort(OV7670_PLK));
    pclkMask = digitalPinToBitMask(OV7670_PLK);

    bool ret = OV767X::begin(VGA, format, fps);
    width = OV767X::width();
    height = OV767X::height();
    bytes_per_pixel = OV767X::bytesPerPixel();
    bytes_per_row = width * bytes_per_pixel;
    resize_height = 2;

    buf_mem = NULL;
    raw_buf = NULL;
    intrp_buf = NULL;

    return ret;
}

int OV7675::allocate_scratch_buffs()
{
    buf_rows = height / resize_row_sz * resize_height;
    buf_size = bytes_per_row * buf_rows;

    buf_mem = ei_malloc(buf_size);
    if(buf_mem == NULL) {
        ei_printf("failed to create buf_mem\r\n");
        return false;
    }
    raw_buf = (uint8_t *)DWORD_ALIGN_PTR((uintptr_t)buf_mem);
    return 0;
}

int OV7675::deallocate_scratch_buffs()
{
    ei_free(buf_mem);
    buf_mem = NULL;
    return 0;
}

void OV7675::readFrame(void* buffer)
{
    allocate_scratch_buffs();

    uint8_t* out = (uint8_t*)buffer;
    noInterrupts();

    while ((*vsyncPort & vsyncMask) == 0);
    while ((*vsyncPort & vsyncMask) != 0);

    int out_row = 0;
    for (int raw_height = 0; raw_height < height; raw_height += buf_rows) {
        readBuf();
        resizeImage(width, buf_rows, raw_buf, resize_col_sz, resize_height, &(out[out_row]), 16);
        out_row += resize_col_sz * resize_height * bytes_per_pixel;
    }

    interrupts();
    deallocate_scratch_buffs();
}

void OV7675::readBuf()
{
    int offset = 0;
    uint32_t ulPin = 33;
    NRF_GPIO_Type * port;
    port = nrf_gpio_pin_port_decode(&ulPin);

    for (int i = 0; i < buf_rows; i++) {
        while ((*hrefPort & hrefMask) == 0);
        for (int col = 0; col < bytes_per_row; col++) {
            while ((*pclkPort & pclkMask) != 0);
            uint32_t in = port->IN;
            in >>= 2;
            in &= 0x3f03;
            in |= (in >> 6);
            raw_buf[offset++] = in;
            while ((*pclkPort & pclkMask) == 0);
        }
        while ((*hrefPort & hrefMask) != 0);
    }
}
