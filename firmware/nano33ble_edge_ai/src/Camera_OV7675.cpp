#include "Camera_OV7675.h"
#include "Image_Utils.h"

// Timeout for waiting on camera signals (reduced for faster failure detection)
static const uint32_t CAMERA_WAIT_SPINS = 500000UL;

// Helper to get port and mask for a pin on nRF52840 (Mbed Arduino core)
static void getPinPortAndMask(int pin, volatile uint32_t** port, uint32_t* mask) {
    // digitalPinToPinName returns PinName which encodes port and pin: (port << 5) | pin_num
    PinName pinName = digitalPinToPinName(pin);
    uint32_t nrfPin = pinName & 0x1F;      // Lower 5 bits = pin number (0-31)
    uint32_t nrfPort = (pinName >> 5) & 1; // Bit 5 = port (0 or 1)

    if (nrfPort == 1) {
        *port = &NRF_P1->IN;
    } else {
        *port = &NRF_P0->IN;
    }
    *mask = 1 << nrfPin;
}

static inline bool waitForPinState(volatile uint32_t* port, uint32_t mask, bool targetHigh)
{
    uint32_t spins = CAMERA_WAIT_SPINS;
    while (spins--) {
        bool isHigh = ((*port & mask) != 0);
        if (isHigh == targetHigh) {
            return true;
        }
    }
    return false;
}


int OV7675::begin(int resolution, int format, int fps)
{
    pinMode(OV7670_VSYNC, INPUT);
    pinMode(OV7670_HREF, INPUT);
    pinMode(OV7670_PLK, INPUT);
    pinMode(OV7670_XCLK, OUTPUT);

    // Use proper nRF52840 port/mask calculation
    getPinPortAndMask(OV7670_VSYNC, &vsyncPort, &vsyncMask);
    getPinPortAndMask(OV7670_HREF, &hrefPort, &hrefMask);
    getPinPortAndMask(OV7670_PLK, &pclkPort, &pclkMask);

    // init driver with the requested resolution
    bool ret = OV767X::begin(resolution, format, fps);
    width = OV767X::width();
    height = OV767X::height();
    bytes_per_pixel = OV767X::bytesPerPixel();
    bytes_per_row = width * bytes_per_pixel;
    resize_height = 2;

    // Default resize params (prevent zero div)
    resize_col_sz = EI_CAMERA_RAW_FRAME_BUFFER_COLS;
    resize_row_sz = EI_CAMERA_RAW_FRAME_BUFFER_ROWS;

    buf_mem = NULL;
    raw_buf = NULL;

    return ret;
}

int OV7675::allocate_scratch_buffs()
{
    if (resize_row_sz == 0) resize_row_sz = 1;

    buf_rows = height / resize_row_sz * resize_height;
    buf_size = bytes_per_row * buf_rows;

    buf_mem = malloc(buf_size);
    if(buf_mem == NULL) {
        return -1;
    }
    raw_buf = (uint8_t *)DWORD_ALIGN_PTR((uintptr_t)buf_mem);

    return 0;
}

int OV7675::deallocate_scratch_buffs()
{
    free(buf_mem);
    buf_mem = NULL;
    return 0;
}

bool OV7675::readFrame(void* buffer)
{
    Serial.print("A");  // Allocating
    if (allocate_scratch_buffs() != 0) {
        Serial.println("!A");
        return false;
    }

    uint8_t* out = (uint8_t*)buffer;

    Serial.print("V");  // Waiting for VSYNC
    Serial.flush();
    noInterrupts();

    // Wait for VSYNC HIGH (start of vertical blanking)
    if (!waitForPinState(vsyncPort, vsyncMask, true)) {
        interrupts();
        deallocate_scratch_buffs();
        Serial.println("!V1");
        return false;
    }

    // Wait for VSYNC LOW (start of active frame)
    if (!waitForPinState(vsyncPort, vsyncMask, false)) {
        interrupts();
        deallocate_scratch_buffs();
        Serial.println("!V0");
        return false;
    }

    interrupts();
    Serial.print("R");  // Reading rows
    Serial.flush();
    noInterrupts();

    int out_row = 0;
    for (int raw_height = 0; raw_height < height; raw_height += buf_rows) {
        if (!readBuf()) {
            interrupts();
            deallocate_scratch_buffs();
            Serial.println("!R");
            return false;
        }

        resizeImage(width, buf_rows,
                    raw_buf,
                    resize_col_sz, resize_height,
                    &(out[out_row]),
                    16);

        out_row += resize_col_sz * resize_height * bytes_per_pixel;
    }

    interrupts();
    Serial.print("D ");  // Done
    deallocate_scratch_buffs();
    return true;
}

bool OV7675::readBuf()
{
    int offset = 0;

    // Get P1 port for reading data pins (D2-D9 are on P1.xx)
    uint32_t ulPin = 33;
    NRF_GPIO_Type* port = nrf_gpio_pin_port_decode(&ulPin);

    for (int i = 0; i < buf_rows; i++) {
        // Wait for HREF HIGH (start of line)
        if (!waitForPinState(hrefPort, hrefMask, true)) {
            return false;
        }

        for (int col = 0; col < bytes_per_row; col++) {
            // Wait for PCLK LOW
            if (!waitForPinState(pclkPort, pclkMask, false)) {
                return false;
            }

            // Read all data bits in parallel from P1
            uint32_t in = port->IN;
            in >>= 2;
            in &= 0x3f03;
            in |= (in >> 6);
            raw_buf[offset++] = in;

            // Wait for PCLK HIGH
            if (!waitForPinState(pclkPort, pclkMask, true)) {
                return false;
            }
        }

        // Wait for HREF LOW (end of line)
        if (!waitForPinState(hrefPort, hrefMask, false)) {
            return false;
        }
    }
    return true;
}
