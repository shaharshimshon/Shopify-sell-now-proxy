const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      item_title,
      item_description,
      item_price,
      seller_name,
      email,
      item_image_base64_1,
      item_image_base64_2,
      item_image_base64_3,
      item_image_base64_4,
      item_image_base64_5
    } = req.body;

    // Validate required fields
    if (!item_title || !item_description || !item_price || !seller_name || !email) {
      return res.status(400).json({ error: 'All required fields must be provided.' });
    }

    const price = parseFloat(item_price);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number.' });
    }

    // Shopify API configuration
    const shopifyStore = 'https://sleepelse.myshopify.com'; // Replace with your store domain
    const apiToken = process.env.SHOPIFY_API_TOKEN;
    const apiVersion = '2023-10';

    // Collect base64 images
    const images = [
      item_image_base64_1,
      item_image_base64_2,
      item_image_base64_3,
      item_image_base64_4,
      item_image_base64_5
    ].filter(Boolean);

    // Upload images to Shopify Files
    const imageUrls = [];
    for (let i = 0; i < images.length; i++) {
      const base64String = images[i];
      if (base64String) {
        const base64Content = base64String.split(',')[1];
        const filename = `image-${Date.now()}-${i + 1}.jpg`;

        const fileResponse = await fetch(
          `https://${shopifyStore}/admin/api/${apiVersion}/files.json`,
          {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': apiToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file: {
                filename: filename,
                attachment: base64Content
              }
            })
          }
        );

        const fileResult = await fileResponse.json();
        if (fileResult.file && fileResult.file.url) {
          imageUrls.push(fileResult.file.url);
        } else {
          throw new Error(`Failed to upload image ${i + 1}`);
        }
      }
    }

    // Create a draft product
    const productResponse = await fetch(
      `https://${shopifyStore}/admin/api/${apiVersion}/products.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product: {
            title: item_title,
            body_html: item_description,
            status: 'draft',
            variants: [
              {
                price: price,
                inventory_management: 'shopify',
                inventory_quantity: 1
              }
            ],
            images: imageUrls.map((url, index) => ({
              src: url,
              position: index + 1
            })),
            metafields: [
              {
                key: 'seller_name',
                value: seller_name,
                type: 'single_line_text_field',
                namespace: 'custom'
              },
              {
                key: 'seller_email',
                value: email,
                type: 'single_line_text_field',
                namespace: 'custom'
              }
            ]
          }
        })
      }
    );

    const productResult = await productResponse.json();
    if (productResult.product) {
      res.status(200).json({ message: 'Submission successful! Your product has been created as a draft.' });
    } else {
      throw new Error('Failed to create draft product');
    }
  } catch (error) {
    console.error('Error processing submission:', error.message);
    res.status(500).json({ error: `Error submitting form: ${error.message}` });
  }
};
