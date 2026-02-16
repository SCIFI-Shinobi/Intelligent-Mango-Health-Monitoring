#include "Camera_OV7675.h"
#include "Image_Utils.h"
#include <nrf_gpio.h>

// Hardware specific macros for nRF52
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

    // init driver to use full image sensor size
    bool ret = OV767X::begin(VGA, format, fps);
    width = OV767X::width();   // full sensor width
    height = OV767X::height(); // full sensor height
    bytes_per_pixel = OV767X::bytesPerPixel();
    bytes_per_row = width * bytes_per_pixel; // each pixel is 2 bytes
    resize_height = 2;                       // Hardcoded downsample by 2 vertical

    // Default resize params (prevent zero div)
    resize_col_sz = EI_CAMERA_RAW_FRAME_BUFFER_COLS;
    resize_row_sz = EI_CAMERA_RAW_FRAME_BUFFER_ROWS;

    buf_mem = NULL;
    raw_buf = NULL;

    return ret;
}

int OV7675::allocate_scratch_buffs()
{
    // Ensure we don't divide by zero
    if (resize_row_sz == 0)
        resize_row_sz = 1;

    buf_rows = height / resize_row_sz * resize_height;
    buf_size = bytes_per_row * buf_rows;

    buf_mem = malloc(buf_size);
    if (buf_mem == NULL)
    {
        return false;
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

void OV7675::readFrame(void *buffer)
{
    allocate_scratch_buffs();

    uint8_t *out = (uint8_t *)buffer;
    noInterrupts();

    // Falling edge indicates start of frame
    while ((*vsyncPort & vsyncMask) == 0)
        ; // wait for HIGH
    while ((*vsyncPort & vsyncMask) != 0)
        ; // wait for LOW

    int out_row = 0;
    for (int raw_height = 0; raw_height < height; raw_height += buf_rows)
    {
        // read in 640xbuf_rows buffer to work with
        readBuf();

        resizeImage(width, buf_rows,
                    raw_buf,
                    resize_col_sz, resize_height,
                    &(out[out_row]),
                    16);

        out_row += resize_col_sz * resize_height * bytes_per_pixel; /* resize_col_sz * 2 * 2 */
    }

    interrupts();

    deallocate_scratch_buffs();
}

void OV7675::readBuf()
{
    int offset = 0;

    uint32_t ulPin = 33; // P1.xx set of GPIO is in 'pin' 32 and above
    NRF_GPIO_Type *port;

    port = nrf_gpio_pin_port_decode(&ulPin);

    for (int i = 0; i < buf_rows; i++)
    {
        // rising edge indicates start of line
        while ((*hrefPort & hrefMask) == 0)
            ; // wait for HIGH

        for (int col = 0; col < bytes_per_row; col++)
        {
            // rising edges clock each data byte
            while ((*pclkPort & pclkMask) != 0)
                ; // wait for LOW

            uint32_t in = port->IN; // read all bits in parallel

            in >>= 2;        // place bits 0 and 1 at the "bottom" of the register
            in &= 0x3f03;    // isolate the 8 bits we care about
            in |= (in >> 6); // combine the upper 6 and lower 2 bits

            raw_buf[offset++] = in;

            while ((*pclkPort & pclkMask) == 0)
                ; // wait for HIGH
        }

        while ((*hrefPort & hrefMask) != 0)
            ; // wait for LOW
    }
}
