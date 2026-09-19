from PIL import Image
import os

input_path = r'c:\Users\PREETI\Desktop\Preethi\Projects\Ideathon\Smart-Helmet\Smart-Helmet\SmartHelmetApp\assets\images\waste1.png'
output_path = r'c:\Users\PREETI\Desktop\Preethi\Projects\Ideathon\Smart-Helmet\Smart-Helmet\SmartHelmetApp\assets\images\waste1_small.png'

try:
    with Image.open(input_path) as img:
        # Resize to a max dimension of 400px while maintaining aspect ratio
        img.thumbnail((400, 400))
        # Save with optimization
        img.save(output_path, optimize=True)
    
    print(f"Original size: {os.path.getsize(input_path)} bytes")
    print(f"New size: {os.path.getsize(output_path)} bytes")
    
    # Replace original with small one
    os.replace(output_path, input_path)
    print("Optimization complete: waste1.png has been replaced with a smaller version.")

except Exception as e:
    print(f"Error: {e}")
