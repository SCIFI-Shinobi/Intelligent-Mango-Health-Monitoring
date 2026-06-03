import smbus2 as smbus
import time

LCD_WIDTH = 16   # Maximum characters per line

LCD_CHR = 1 # Mode - Sending data
LCD_CMD = 0 # Mode - Sending command

LCD_LINE_1 = 0x80 # LCD RAM address for the 1st line
LCD_LINE_2 = 0xC0 # LCD RAM address for the 2nd line

LCD_BACKLIGHT = 0x08  # On
ENABLE = 0b00000100   # Enable bit


class LCD:
    def __init__(self, port=1, address=0x3F):
        self.enabled = False  # always set first before anything else
        self.address = address
        self._error_count = 0
        self._MAX_ERRORS = 5   # disable LCD after this many consecutive I2C failures
        try:
            self.bus = smbus.SMBus(port)
            self.init_lcd()
            self.enabled = True
            print("LCD initialized successfully.")
        except Exception as e:
            print(f"LCD Init Error: {e}")

    def init_lcd(self):
        self.lcd_byte(0x33, LCD_CMD)  # Initialise
        self.lcd_byte(0x32, LCD_CMD)  # Initialise
        self.lcd_byte(0x06, LCD_CMD)  # Cursor move direction
        self.lcd_byte(0x0C, LCD_CMD)  # Display On, Cursor Off, Blink Off
        self.lcd_byte(0x28, LCD_CMD)  # Data length, number of lines, font size
        self.lcd_byte(0x01, LCD_CMD)  # Clear display
        time.sleep(0.0005)

    def lcd_byte(self, bits, mode):
        if not self.enabled:
            return
        bits_high = mode | (bits & 0xF0) | LCD_BACKLIGHT
        bits_low  = mode | ((bits << 4) & 0xF0) | LCD_BACKLIGHT
        try:
            self.bus.write_byte(self.address, bits_high)
            self.lcd_toggle_enable(bits_high)
            self.bus.write_byte(self.address, bits_low)
            self.lcd_toggle_enable(bits_low)
            self._error_count = 0  # reset on success
        except Exception as e:
            self._error_count += 1
            if self._error_count <= 1:
                print(f"LCD write error: {e}")
            if self._error_count >= self._MAX_ERRORS:
                print(f"LCD I2C error threshold reached. Attempting re-init...")
                time.sleep(0.5)
                self._error_count = 0
                try:
                    self.init_lcd()
                except Exception:
                    pass

    def lcd_toggle_enable(self, bits):
        time.sleep(0.0005)
        self.bus.write_byte(self.address, (bits | ENABLE))
        time.sleep(0.0005)
        self.bus.write_byte(self.address, (bits & ~ENABLE))
        time.sleep(0.0005)

    def print_line(self, message, line_num):
        if not self.enabled:
            return
        line = LCD_LINE_1 if line_num == 1 else LCD_LINE_2
        # Crop or pad to exactly 16 characters
        message = message[:LCD_WIDTH].ljust(LCD_WIDTH, " ")
        self.lcd_byte(line, LCD_CMD)
        for i in range(LCD_WIDTH):
            self.lcd_byte(ord(message[i]), LCD_CHR)

    def clear(self):
        if not self.enabled:
            return
        self.lcd_byte(0x01, LCD_CMD)
        time.sleep(0.002)