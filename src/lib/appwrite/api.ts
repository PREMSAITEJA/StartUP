import { ID, Query, Client, Account, Databases, Storage, Avatars } from "appwrite"; // Ensure all necessary Appwrite modules are imported

import { appwriteConfig } from "./config"; // Assuming appwriteConfig is correctly imported
import { IUpdatePost, INewPost, INewUser, IUpdateUser } from "@/types";

// Initialize Appwrite services (make sure this is done correctly, perhaps in config.ts)
// If you have these initialized and exported in config.ts, you might remove
// these initialization lines here and directly use the imported instances.
// Based on your import structure, it seems you are initializing here,
// but ideally, initialize once in config.ts and import the initialized instances.
const client = new Client();
client.setEndpoint(appwriteConfig.url).setProject(appwriteConfig.projectId);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const avatars = new Avatars(client);


// ============================================================
// AUTH
// ============================================================

// ============================== SIGN UP
export async function createUserAccount(user: INewUser) {
  try {
    const newAccount = await account.create(
      ID.unique(),
      user.email,
      user.password,
      user.name
    );

    if (!newAccount) {
        console.error("Appwrite account creation failed.");
        throw new Error("Failed to create user account.");
    }

    const avatarUrl = avatars.getInitials(user.name); // avatars.getInitials returns a string

    // The saveUserToDB function now correctly expects a string for imageUrl
    const newUser = await saveUserToDB({
      accountId: newAccount.$id,
      name: newAccount.name,
      email: newAccount.email,
      username: user.username,
      imageUrl: avatarUrl, // Pass the string directly, no cast needed
    });

    if (!newUser) {
        console.error("Failed to save user to DB after account creation.");
        // Consider deleting the created account here if DB save fails
        // await account.delete(newAccount.$id);
        throw new Error("Failed to save user data.");
    }

    return newUser;
  } catch (error) {
    console.error("Error in createUserAccount:", error);
    throw error; // Re-throw the error for handling in the calling code
  }
}

// ============================== SAVE USER TO DB
// Define imageUrl as string here as avatars.getInitials returns string
export async function saveUserToDB(user: {
  accountId: string;
  email: string;
  name: string;
  imageUrl: string; // Correctly defined as string
  username?: string;
}) {
  try {
    const newUser = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      user
    );

    return newUser;
  } catch (error) {
    console.error("Error in saveUserToDB:", error);
    throw error; // Re-throw the error
  }
}

// ============================== SIGN IN
export async function signInAccount(user: { email: string; password: string }) {
  try {
    const session = await account.createEmailSession(user.email, user.password);
    return session;
  } catch (error) {
    console.error("Error in signInAccount:", error);
    throw error;
  }
}

// ============================== GET ACCOUNT
export async function getAccount() {
  try {
    const currentAccount = await account.get();
    return currentAccount;
  } catch (error) {
    console.error("Error in getAccount:", error);
    // Do not throw here, as getAccount failing just means no user is logged in.
    return null;
  }
}

// ============================== GET USER
export async function getCurrentUser() {
  try {
    const currentAccount = await getAccount();
    if (!currentAccount) return null; // Return null if no account is found

    const currentUser = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal("accountId", currentAccount.$id)]
    );

    if (!currentUser || currentUser.documents.length === 0) {
        console.error("User document not found for account ID:", currentAccount.$id);
        return null; // Return null if user document is not found
    }


    return currentUser.documents[0];
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}

// ============================== SIGN OUT
export async function signOutAccount() {
  try {
    const session = await account.deleteSession("current");
    return session;
  } catch (error) {
    console.error("Error in signOutAccount:", error);
    throw error;
  }
}

// ============================================================
// POSTS
// ============================================================

// ============================== CREATE POST
export async function createPost(post: INewPost) {
  try {
    // Upload file to appwrite storage
    const uploadedFile = await uploadFile(post.file[0]);

    if (!uploadedFile) {
        throw new Error("File upload failed.");
    }

    // Get file url (now returns string)
    const fileUrl = getFilePreview(uploadedFile.$id);
    if (!fileUrl) {
      // If preview fails, delete the uploaded file
      await deleteFile(uploadedFile.$id);
      throw new Error("Failed to get file preview URL.");
    }

    // Convert tags into array
    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    // Create post document in database
    const newPost = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      ID.unique(),
      {
        creator: post.userId,
        caption: post.caption,
        imageUrl: fileUrl, // Now storing the correct URL string
        imageId: uploadedFile.$id, // Store the file ID
        location: post.location,
        tags: tags,
      }
    );

    if (!newPost) {
      // If document creation fails, delete the uploaded file
      await deleteFile(uploadedFile.$id);
      throw new Error("Failed to create post document.");
    }

    return newPost;
  } catch (error) {
    console.error("Error in createPost:", error);
    throw error;
  }
}

// ============================== UPLOAD FILE
export async function uploadFile(file: File) {
  try {
    const uploadedFile = await storage.createFile(
      appwriteConfig.storageId,
      ID.unique(),
      file
    );
    return uploadedFile;
  } catch (error) {
    console.error("Error in uploadFile:", error);
    throw error; // Re-throw the error
  }
}

// ============================== GET FILE URL (MODIFIED)
// This function now correctly returns a string URL
export function getFilePreview(fileId: string) {
  try {
    const fileUrl = storage.getFilePreview(
      appwriteConfig.storageId,
      fileId,
      2000, // Optional: Adjust width
      2000, // Optional: Adjust height
      "top", // Optional: Adjust crop mode
      100   // Optional: Adjust quality
    );

    if (!fileUrl) {
        // Handle the case where getFilePreview might return null or undefined
        console.error("getFilePreview returned null for fileId:", fileId);
        return null; // Explicitly return null or handle appropriately
    }

    // **CRUCIAL CHANGE:** Return the URL string using .href
    return fileUrl.href;

  } catch (error) {
    console.error("Error getting file preview for fileId:", fileId, error);
    // Return null on error
    return null;
  }
}

// ============================== DELETE FILE
export async function deleteFile(fileId: string) {
  try {
    // storage.deleteFile returns a promise resolving to void, not a status code object
    await storage.deleteFile(appwriteConfig.storageId, fileId);
    return { status: "ok" }; // Indicate success
  } catch (error) {
    console.error("Error in deleteFile:", error);
    throw error; // Re-throw the error
  }
}

// ============================== GET POSTS (Simplified error handling)
export async function searchPosts(searchTerm: string) {
  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      [Query.search("caption", searchTerm)]
    );

    return posts; // Return the documents or an empty array if none found
  } catch (error) {
    console.error("Error in searchPosts:", error);
    throw error; // Re-throw the error
  }
}

export async function getInfinitePosts({ pageParam }: { pageParam: number }) {
  const queries: any[] = [Query.orderDesc("$updatedAt"), Query.limit(9)];

  if (pageParam) {
    queries.push(Query.cursorAfter(pageParam.toString()));
  }

  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      queries
    );

    return posts; // Return the documents
  } catch (error) {
    console.error("Error in getInfinitePosts:", error);
    throw error; // Re-throw the error
  }
}

// ============================== GET POST BY ID
export async function getPostById(postId?: string) {
  if (!postId) {
    // Log or handle the missing ID case more gracefully if needed
    throw new Error("Post ID is required to fetch.");
  }

  try {
    const post = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    );

    return post; // Return the document
  } catch (error) {
    console.error(`Error while fetching post with ID: ${postId}`, error);
    throw error; // Re-throw the error
  }
}

// ============================== UPDATE POST
export async function updatePost(post: IUpdatePost) {
  // Ensure post.file is an array and has elements
  const hasFileToUpdate = post.file && Array.isArray(post.file) && post.file.length > 0;

  try {
    let image = {
      imageUrl: post.imageUrl || "", // Use existing imageUrl if no new file
      imageId: post.imageId || "",   // Use existing imageId if no new file
    };

    if (hasFileToUpdate) {
      // Upload new file to appwrite storage
      const uploadedFile = await uploadFile(post.file[0]);
      if (!uploadedFile) {
        throw new Error("Failed to upload new file for post update.");
      }

      // Get new file url (now returns string)
      const fileUrl = getFilePreview(uploadedFile.$id);
      if (!fileUrl) {
        // If preview fails, delete the newly uploaded file
        await deleteFile(uploadedFile.$id);
        throw new Error("Failed to generate new file preview URL.");
      }

      image = { imageUrl: fileUrl, imageId: uploadedFile.$id }; // Update image info with new file
    }

    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    const updatedPost = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      post.postId,
      {
        caption: post.caption ?? "No caption", // Use nullish coalescing for default
        imageUrl: image.imageUrl, // Now storing the correct URL string
        imageId: image.imageId,
        location: post.location ?? "Unknown location", // Use nullish coalescing for default
        tags: tags,
      }
    );

    if (!updatedPost) {
      // If document update fails
      if (hasFileToUpdate && image.imageId) { // Check if a new file was uploaded and has an ID
        await deleteFile(image.imageId); // Attempt to delete the newly uploaded file
      }
      throw new Error("Failed to update post document.");
    }

    // Safely delete old file after successful update if a new file was uploaded
    // Ensure post.imageId exists and is different from the new image.imageId if applicable
    if (hasFileToUpdate && post.imageId && post.imageId !== image.imageId) {
        try {
             await deleteFile(post.imageId);
        } catch(oldFileDeleteError) {
             console.warn(`Failed to delete old file with ID ${post.imageId}:`, oldFileDeleteError);
             // Continue even if deleting the old file fails
        }
    }

    return updatedPost;
  } catch (error) {
    console.error(`Error while updating post with ID: ${post.postId}`, error);
    throw error; // Re-throw the error
  }
}

// ============================== DELETE POST
export async function deletePost(postId?: string, imageId?: string) {
  if (!postId) {
    throw new Error("Post ID is required to delete");
  }

  try {
    // Delete the post document
    // databases.deleteDocument returns a promise resolving to void, not a status code object
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    );

    console.log(`Successfully deleted post document with ID: ${postId}`);


    // If an imageId was provided, attempt to delete the file from storage
    if (imageId) {
      try {
        // deleteFile is now refactored to handle its own errors
        await deleteFile(imageId); // Call the refactored deleteFile
      } catch (deleteFileError) {
        // deleteFile function already logs its own errors, no need to re-log here
        // Just ensure we catch so post document deletion success is returned
      }
    }

    return { status: "Ok", message: "Post and associated file (if any) deleted successfully." };

  } catch (error) {
    console.error(`Error while deleting post document with ID: ${postId}`, error);
    // If post document deletion fails, re-throw the error
    throw error;
  }
}


// ============================== LIKE / UNLIKE POST
export async function likePost(postId: string, likesArray: string[]) {
  try {
    const updatedPost = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId,
      {
        likes: likesArray,
      }
    );

    if (!updatedPost) {
         throw new Error("Failed to update post likes.");
    }

    return updatedPost;
  } catch (error) {
    console.error(`Error in likePost for post ID: ${postId}`, error);
    throw error;
  }
}

// ============================== SAVE POST
export async function savePost(userId: string, postId: string) {
  try {
    // Check if the post is already saved by this user to avoid duplicates
    const existingSaves = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.savesCollectionId,
        [
            Query.equal('user', userId),
            Query.equal('post', postId)
        ]
    );

    if (existingSaves.total > 0) {
        console.warn(`Post ${postId} is already saved by user ${userId}.`);
        // Optionally return the existing save document
        return existingSaves.documents[0];
    }

    const newSave = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.savesCollectionId,
      ID.unique(),
      {
        user: userId,
        post: postId,
      }
    );

    if (!newSave) {
        throw new Error("Failed to create save document.");
    }

    return newSave;
  } catch (error) {
    console.error(`Error in savePost for user ${userId} and post ${postId}:`, error);
    throw error;
  }
}

// ============================== DELETE SAVED POST
export async function deleteSavedPost(savedRecordId: string) {
  try {
    // databases.deleteDocument returns a promise resolving to void
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.savesCollectionId,
      savedRecordId
    );

    console.log(`Successfully deleted saved post record with ID: ${savedRecordId}`);

    return { status: "Ok", message: "Saved post deleted successfully." };
  } catch (error) {
    console.error(`Error in deleteSavedPost for record ID: ${savedRecordId}`, error);
    throw error; // Re-throw the error
  }
}

// ============================== GET USER'S POST
export async function getUserPosts(userId?: string) {
  if (!userId) {
      console.warn("userId not provided for getUserPosts");
      return null; // Or return an empty array []
  }

  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      [Query.equal("creator", userId), Query.orderDesc("$createdAt")]
    );

    return posts; // Return the documents
  } catch (error) {
    console.error(`Error in getUserPosts for user ID: ${userId}`, error);
    throw error;
  }
}

// ============================== GET RECENT POSTS
export async function getRecentPosts() {
  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      [Query.orderDesc("$createdAt"), Query.limit(20)]
    );

    return posts; // Return the documents
  } catch (error) {
    console.error("Error in getRecentPosts:", error);
    throw error;
  }
}

// ============================================================
// USER
// ============================================================

// ============================== GET USERS
export async function getUsers(limit?: number) {
  const queries: any[] = [Query.orderDesc("$createdAt")];

  if (limit) {
    queries.push(Query.limit(limit));
  }

  try {
    const users = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      queries
    );

    return users; // Return the documents
  } catch (error) {
    console.error("Error in getUsers:", error);
    throw error;
  }
}

// ============================== GET USER BY ID
export async function getUserById(userId: string) {
  try {
    const user = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId
    );

    return user; // Return the document
  } catch (error) {
    console.error(`Error in getUserById for user ID: ${userId}`, error);
    throw error;
  }
}

// ============================== UPDATE USER
export async function updateUser(user: IUpdateUser) {
  const hasFileToUpdate = user.file && Array.isArray(user.file) && user.file.length > 0;
  try {
    let image = {
      imageUrl: user.imageUrl, // Use existing imageUrl from input
      imageId: user.imageId,   // Use existing imageId from input
    };

    if (hasFileToUpdate) {
      // Upload new file to appwrite storage
      const uploadedFile = await uploadFile(user.file[0]);
      if (!uploadedFile) {
          throw new Error("Failed to upload new profile image.");
      }

      // Get new file url (now returns string)
      const fileUrl = getFilePreview(uploadedFile.$id);
      if (!fileUrl) {
          // If preview fails, delete the newly uploaded file
          await deleteFile(uploadedFile.$id);
          throw new Error("Failed to get new profile image URL.");
      }

      image = { imageUrl: fileUrl, imageId: uploadedFile.$id }; // Update image info with new file
    }

    //  Update user document
    const updatedUser = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      user.userId,
      {
        name: user.name,
        bio: user.bio ?? "", // Use nullish coalescing for default empty string
        imageUrl: image.imageUrl, // Now storing the correct URL string
        imageId: image.imageId,
      }
    );

    // Failed to update user document
    if (!updatedUser) {
      if (hasFileToUpdate && image.imageId) { // Check if a new file was uploaded and has an ID
        await deleteFile(image.imageId); // Attempt to delete the newly uploaded file
      }
      throw new Error(`Failed to update user document for ID: ${user.userId}`);
    }

    // Safely delete old file after successful update if a new file was uploaded
    // Ensure user.imageId exists (old image) and is different from the new image.imageId
    if (hasFileToUpdate && user.imageId && user.imageId !== image.imageId) {
        try {
            await deleteFile(user.imageId);
        } catch(oldFileDeleteError) {
            console.warn(`Failed to delete old profile image with ID ${user.imageId}:`, oldFileDeleteError);
            // Continue even if deleting the old file fails
        }
    }

    return updatedUser;
  } catch (error) {
    console.error(`Error while updating user with ID: ${user.userId}`, error);
    throw error; // Re-throw the error
  }
}

// ============================== GET FOLLOWERS COUNT
export async function getFollowersCount(userId: string) {
  try {
    const followers = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId || '', // Ensure collectionId is defined
      [Query.equal("followingId", userId)]
    );

    if (!followers) return 0; // Return 0 if no documents found

    return followers.total;
  } catch (error) {
    console.error(`Error in getFollowersCount for user ID: ${userId}`, error);
    throw error;
  }
}

// ============================== GET FOLLOWING COUNT
export async function getFollowingCount(userId: string) {
  try {
    // Ensure collectionId is defined and not null/undefined
    if (!appwriteConfig.followersCollectionId) {
       console.error("followersCollectionId is not defined in appwriteConfig.");
       return 0; // Or throw an error
    }

    const following = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId,
      [Query.equal("followerId", userId)]
    );

    if (!following) return 0; // Return 0 if no documents found


    return following.total;
  } catch (error) {
    console.error(`Error in getFollowingCount for user ID: ${userId}`, error);
    throw error;
  }
}

// ============================== FOLLOW USER
export async function followUser(followerId: string, followingId: string) {
  try {
    // Optional: Check if already following to prevent duplicates
    const existingFollow = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.followersCollectionId,
        [
            Query.equal('followerId', followerId),
            Query.equal('followingId', followingId)
        ]
    );

    if (existingFollow.total > 0) {
        console.warn(`User ${followerId} is already following user ${followingId}.`);
        return existingFollow.documents[0]; // Return the existing follow document
    }

    const newFollower = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId,
      ID.unique(),
      {
        followerId,
        followingId,
      }
    );

    if (!newFollower) {
        throw new Error("Failed to create follow document.");
    }


    return newFollower;
  } catch (error) {
    console.error(`Error in followUser: follower ${followerId}, following ${followingId}`, error);
    throw error;
  }
}

// ============================== UNFOLLOW USER
export async function unfollowUser(followerId: string, followingId: string) {
  try {
    const followers = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId,
      [
        Query.equal("followerId", followerId),
        Query.equal("followingId", followingId),
      ]
    );

    if (followers.total > 0) {
      const followerDocId = followers.documents[0].$id;
      // databases.deleteDocument returns a promise resolving to void
      await databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.followersCollectionId,
        followerDocId
      );
       console.log(`Successfully unfollowed user ${followingId} by user ${followerId}.`);
    } else {
        console.warn(`No follow relationship found between user ${followerId} and user ${followingId} to unfollow.`);
    }
    // Return a success indicator even if no relationship was found to delete
    return { status: "Ok", message: "Unfollow process completed." };

  } catch (error) {
    console.error(`Error in unfollowUser: follower ${followerId}, following ${followingId}`, error);
    throw error;
  }
}
