import kagglehub

# Download latest version
path = kagglehub.dataset_download("eraakash/indian-sign-language-hand-landmarks-dataset")

print("Path to dataset files:", path)