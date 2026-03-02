import styles from "./CreatePost.module.css";
import React, { useEffect, useRef, useState } from "react";
import { POST_CATEGORY, VISIBILITY } from "../../../utils/Enums";
import { renderObjects } from "../../../utils/Helpers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../Context/AuthContext";

const CreatePost = () => {
  const navigate = useNavigate();
  const { setLoading } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
    visibility: "public",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (imgPreview) {
        URL.revokeObjectURL(imgPreview);
      }
    };
  }, [imgPreview]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setImageFile(file);
    setImgPreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (imgPreview) {
      URL.revokeObjectURL(imgPreview);
    }
    setImageFile(null);
    setImgPreview(null);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const inputs = new FormData();
    inputs.append("title", formData.title);
    inputs.append("category", formData.category);
    inputs.append("visibility", formData.visibility);
    inputs.append("content", formData.content);

    if (imageFile) {
      inputs.append("upload", imageFile);
    }

    try {
      setLoading(true);
      const response = await fetch("/api/create/post", {
        method: "POST",
        credentials: "include",
        body: inputs,
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      setLoading(false);
      toast.success(data.message);
      navigate("/posts");
    } catch (error) {
      setLoading(false);
      console.error("[NEW POST ERROR]: ", error);
      toast.error(error.message);
    }
  };

  return (
    <div className={styles.newPostContainer}>
      <form className={styles.newPostForm} onSubmit={handleSubmit}>
        <div className={styles.formIntro}>
          <h1>Create Post</h1>
          <p>Share updates, alerts, and training notes with clear visibility.</p>
        </div>
        <div>
          <label htmlFor="title">Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
          >
            <option value="">--select category--</option>
            {renderObjects(POST_CATEGORY)}
          </select>
        </div>
        <div>
          <label htmlFor="visibility">Post Visibility</label>
          <select
            name="visibility"
            value={formData.visibility}
            onChange={handleChange}
          >
            <option value="">--select post visibility--</option>
            {renderObjects(VISIBILITY)}
          </select>
        </div>
        <div>
          <label htmlFor="content">Say Something</label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
          ></textarea>
          <small className={styles.fieldHint}>
            Keep this concise and action-focused so it is easy to scan.
          </small>
        </div>
        <div className={styles.fileUpload}>
          <label htmlFor="upload">Upload an Image</label>
          <input
            type="file"
            name="upload"
            id="upload"
            accept="image/*"
            ref={fileRef}
            onChange={handleFileChange}
          />
          <small className={styles.fieldHint}>
            Optional. Use JPG/PNG/WebP for fastest load times.
          </small>
        </div>
        {imgPreview && (
          <div className={styles.imageDisplay}>
            <button
              type="button"
              className={styles.removeImage}
              onClick={handleRemoveImage}
            >
              <FontAwesomeIcon icon={faCircleXmark} />
            </button>
            <img src={imgPreview} alt="PREVIEW" className={styles.imgPreview} />
          </div>
        )}
        <button type="submit">Create New Post</button>
      </form>
    </div>
  );
};

export default CreatePost;
