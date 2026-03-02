import styles from "./Posts.module.css";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../Context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBackwardStep,
  faBell,
  faBreadSlice,
  faBullhorn,
  faEarthAmericas,
  faForwardStep,
  faGraduationCap,
  faPenClip,
} from "@fortawesome/free-solid-svg-icons";
import { convertDateFromStr, getAssetUrl } from "../../../../utils/Helpers";
import { POST_CATEGORY } from "../../../../utils/Enums";

const Posts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [postMeta, setPostMeta] = useState({
    category: "general",
    page: 1,
    limit: 2,
    total_posts: 0,
    total_pages: 1,
  });
  const { category, page, limit } = postMeta;

  useEffect(() => {
    const controller = new AbortController();

    const getPosts = async () => {
      try {
        const response = await fetch(
          `/api/read/posts/${category}/${page}/${limit}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message);
        }
        setPosts(data.posts);
        setPostMeta((prev) => ({
          ...prev,
          total_pages: data.total_pages,
          total_posts: data.total_posts,
        }));
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("[SCHEDULE QUERY ERROR]: ", error);
        toast.error(error.message);
      }
    };
    getPosts();
    return () => controller.abort();
  }, [category, page, limit]);

  useEffect(() => {
    const controller = new AbortController();

    const markPostsAsSeen = async () => {
      try {
        const response = await fetch("/api/read/posts/all/1/1", {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!data.success || !data.posts?.length || !user?.id) return;

        const latestPost = data.posts[0];
        localStorage.setItem(
          `posts_last_seen_${user.id}`,
          JSON.stringify({
            id: latestPost.id,
            created_at: latestPost.created_at,
          }),
        );
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    };

    markPostsAsSeen();
    return () => controller.abort();
  }, [user?.id]);

  const handleCategory = (cat) => {
    setPostMeta((prev) => ({
      ...prev,
      category: cat,
      page: 1,
    }));
  };

  const handlePage = (step) => {
    setPostMeta((prev) => {
      let newPage = prev.page + step;

      if (newPage < 1) newPage = 1;
      if (newPage > prev.total_pages) newPage = prev.total_pages;

      return {
        ...prev,
        page: newPage,
      };
    });
  };
  return (
    <div className={styles.portalContainer}>
      <div className={styles.portalHeader}>
        <div className={styles.portalNavi}>
          {/* GENERAL/ALL */}
          <FontAwesomeIcon
            icon={faEarthAmericas}
            className={postMeta.category === "general" ? styles.activeSVG : ""}
            onClick={() => handleCategory("general")}
          />{" "}
          {/* UPDATE */}
          <FontAwesomeIcon
            icon={faBullhorn}
            className={postMeta.category === "update" ? styles.activeSVG : ""}
            onClick={() => handleCategory("update")}
          />{" "}
          {/* ALERTS */}
          <FontAwesomeIcon
            icon={faBell}
            className={postMeta.category === "alert" ? styles.activeSVG : ""}
            onClick={() => handleCategory("alert")}
          />{" "}
          {/* TRAINING */}
          <FontAwesomeIcon
            icon={faGraduationCap}
            className={postMeta.category === "training" ? styles.activeSVG : ""}
            onClick={() => handleCategory("training")}
          />{" "}
          {/* MOTIVATIONAL */}
          <FontAwesomeIcon
            icon={faBreadSlice}
            className={
              postMeta.category === "motivational" ? styles.activeSVG : ""
            }
            onClick={() => handleCategory("motivational")}
          />{" "}
          {/* NEW POST */}
          {user.role === "admin" && (
            <FontAwesomeIcon
              icon={faPenClip}
              onClick={() => navigate("/create-post")}
            />
          )}{" "}
        </div>
        <div className={styles.portalControls}>
          <button onClick={() => handlePage(-1)} disabled={postMeta.page === 1}>
            <FontAwesomeIcon icon={faBackwardStep} />
          </button>
          <span>
            {postMeta.page} / {postMeta.total_pages}
          </span>
          <button
            onClick={() => handlePage(1)}
            disabled={postMeta.page === postMeta.total_pages}
          >
            <FontAwesomeIcon icon={faForwardStep} />
          </button>
        </div>
      </div>
      <div className={styles.postList}>
        <p className={styles.categoryDisplay}>
          {POST_CATEGORY[postMeta.category]} Posts
        </p>
        {posts.length !== 0 ? (
          posts.map(({ id, title, author, file_path, created_at }, index) => (
            <div key={index} className={styles.postItem}>
              <div>
                <p
                  onClick={() => navigate(`/post/${id}`)}
                  className={styles.postTitle}
                >
                  {title}
                </p>
                <small>{convertDateFromStr(created_at)}</small>
                <p>{author.username}</p>
              </div>
              {file_path && (
                <img
                  src={getAssetUrl(file_path)}
                  alt={file_path}
                  className={styles.postItemImage}
                />
              )}
            </div>
          ))
        ) : (
          <div className={styles.postItem}>
            <h3>No {POST_CATEGORY[postMeta.category]} Posts</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default Posts;
