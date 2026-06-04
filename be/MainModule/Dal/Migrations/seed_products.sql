BEGIN;

INSERT INTO products (
  id,
  name,
  description,
  price,
  stock_quantity,
  sku,
  category,
  image_url,
  is_active,
  created_at,
  updated_at
) VALUES
(
  '11111111-1111-1111-1111-111111111001',
  'Wireless Mouse MX100',
  'Ergonomic wireless mouse with silent click',
  29.99,
  120,
  'MOUSE-MX100',
  'Accessories',
  'https://source.unsplash.com/featured/800x600/?wireless-mouse',
  TRUE,
  NOW(),
  NULL
),
(
  '11111111-1111-1111-1111-111111111002',
  'Mechanical Keyboard K87',
  '87-key RGB mechanical keyboard',
  79.50,
  75,
  'KB-K87-RGB',
  'Accessories',
  'https://source.unsplash.com/featured/800x600/?mechanical-keyboard',
  TRUE,
  NOW(),
  NULL
),
(
  '11111111-1111-1111-1111-111111111003',
  'USB-C Hub 7-in-1',
  'Multiport adapter with HDMI and card reader',
  45.00,
  60,
  'HUB-USBC-7IN1',
  'Adapters',
  'https://source.unsplash.com/featured/800x600/?usb-c-hub',
  TRUE,
  NOW(),
  NULL
),
(
  '11111111-1111-1111-1111-111111111004',
  '27-inch Monitor QHD',
  '2560x1440 IPS monitor, 75Hz',
  249.99,
  25,
  'MON-27-QHD',
  'Displays',
  'https://source.unsplash.com/featured/800x600/?computer-monitor',
  TRUE,
  NOW(),
  NULL
),
(
  '11111111-1111-1111-1111-111111111005',
  'Laptop Stand Aluminum',
  'Adjustable aluminum laptop stand',
  34.25,
  90,
  'STAND-ALU-01',
  'Office',
  'https://source.unsplash.com/featured/800x600/?laptop-stand',
  TRUE,
  NOW(),
  NULL
);

COMMIT;